# data_processor.py

import re
import unidecode
from bs4 import BeautifulSoup
import json
import asyncio
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import os
import logging
from content_schema import content_schema
import sys

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Force CPU usage
os.environ['CUDA_VISIBLE_DEVICES'] = ''
torch.set_num_threads(4)  # Adjust this based on your CPU cores

class DataProcessor:
    def __init__(self, progress_callback=None, model_name="mistralai/Mixtral-8x7B-v0.1", num_gpus=1):
        self.progress_callback = progress_callback
        self.model_name = model_name
        self.num_gpus = num_gpus
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logging.info(f"Using device: {self.device}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        try:
            self.model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.float16, low_cpu_mem_usage=True)
            self.model.to(self.device)
            logging.info(f"Model loaded on {self.device}")
        except Exception as e:
            logging.error(f"Failed to load model onto {self.device}: {str(e)}")
            print(f"Error: Failed to load model. Exiting script.")
            sys.exit(1)

    async def process_api_responses(self, api_responses):
        documents = []
        total_responses = len(api_responses)
        tasks = []
        for i, response in enumerate(api_responses):
            task = asyncio.create_task(self.process_single_response(response, i, total_responses))
            tasks.append(task)
        
        documents = await asyncio.gather(*tasks)
        return [doc for sublist in documents for doc in sublist]

    async def process_single_response(self, response, index, total_responses):
        extracted = await self.extract_documents(response)
        if self.progress_callback:
            progress = ((index + 1) / total_responses) * 100
            self.progress_callback(progress)
        return extracted

    async def extract_documents(self, response):
        if not isinstance(response, dict):
            return []

        source = response.get('_source', response)
        es_attachments = source.get('es_attachment', [])
        if isinstance(es_attachments, dict):
            es_attachments = [es_attachments]

        documents = []
        for attachment_info in es_attachments:
            attachment = attachment_info.get('attachment', {})
            content = attachment.get('content', '')
            if content:
                title = attachment.get('title', '') or source.get('title', [''])[0]
                metadata = self.extract_metadata(response, source, attachment_info, attachment)
                processed_content = self.preprocess_text(content)
                structured_content = await self.structure_content(processed_content, title)
                documents.append({
                    'content': structured_content,
                    'title': title,
                    'metadata': metadata
                })
        return documents

    def extract_metadata(self, response, source, attachment_info, attachment):
        return {
            'title': attachment.get('title', '') or source.get('title', [''])[0],
            'document_id': response.get('_id', ''),
            'filename': attachment_info.get('filename', ''),
            'date': attachment.get('date', ''),
            'author': attachment.get('author', ''),
            'language': attachment.get('language', ''),
            'content_type': attachment.get('content_type', ''),
            'content_length': attachment.get('content_length', 0),
            'legislation_type': source.get('type', [''])[0] if isinstance(source.get('type'), list) else source.get('type', ''),
            'legislation_year': source.get('field_legislation_year', [''])[0] if isinstance(source.get('field_legislation_year'), list) else source.get('field_legislation_year', ''),
            'act_number': source.get('field_act_sr_number', [''])[0] if isinstance(source.get('field_act_sr_number'), list) else source.get('field_act_sr_number', ''),
            'effective_date': source.get('field_in_force_effective_date', [''])[0] if isinstance(source.get('field_in_force_effective_date'), list) else source.get('field_in_force_effective_date', ''),
            'version_number': source.get('field_in_force_version_number', [''])[0] if isinstance(source.get('field_in_force_version_number'), list) else source.get('field_in_force_version_number', '')
        }

    def preprocess_text(self, text):
        # Check if the text is likely a filename or short label
        if not text.startswith('<') and not text.startswith('<!') and len(text.split()) < 5:
            return text.strip()
        # Parse HTML and decode Unicode characters
        text = BeautifulSoup(text, "html.parser").get_text()
        text = unidecode.unidecode(text)
        # Preserve newline characters
        text = re.sub(r'[^\S\n]+', ' ', text)
        text = text.replace('ﬁ', 'fi')
        return text.strip()

    async def structure_content(self, text, document_title):
        prompt = f"""
Parse the following legal document text into a structured JSON format. The document title is '{document_title}'.

Text:
{text}

Output a JSON object with the following structure:
{{
    "title": "The title of the document",
    "type": "The type of the document (e.g., 'Act', 'Regulation')",
    "content": [
        {{
            "type": "The type of the section (e.g., 'Part', 'Division', 'Section')",
            "number": "The number or identifier of the section",
            "title": "The title of the section",
            "text": "The main text content of the section",
            "content": [
                // Nested subsections following the same structure
            ]
        }}
    ]
}}

Ensure that the content is structured hierarchically, preserving the original organization of the document. Only include the JSON object in your response, without any additional text.
"""

        try:
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=4096,
                    temperature=0.7,
                    top_p=0.95,
                    do_sample=True
                )

            generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract JSON from the generated text
            json_start = generated_text.find('{')
            json_end = generated_text.rfind('}') + 1
            json_str = generated_text[json_start:json_end]

            structured_content = json.loads(json_str)
            logging.info(f"Successfully structured content for document: {document_title}")
            return structured_content
        except Exception as e:
            logging.error(f"Error during content structuring for document {document_title}: {str(e)}")
            # Fallback: return a basic structure with the original text
            return {
                "title": document_title,
                "type": "Unknown",
                "content": [
                    {
                        "type": "Section",
                        "number": "1",
                        "title": "Full Text",
                        "text": text[:1000] + ("..." if len(text) > 1000 else ""),
                        "content": []
                    }
                ]
            }

    async def process_batch(self, batch):
        tasks = [self.structure_content(text, title) for text, title in batch]
        return await asyncio.gather(*tasks)

    async def process_with_concurrency(self, texts_and_titles, batch_size=4):
        results = []
        for i in range(0, len(texts_and_titles), batch_size):
            batch = texts_and_titles[i:i+batch_size]
            batch_results = await self.process_batch(batch)
            results.extend(batch_results)
        return results
