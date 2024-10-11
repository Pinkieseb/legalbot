# qa_generator.py

import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
import json
import asyncio

nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)

class QAGenerator:
    def __init__(self, progress_callback=None):
        self.progress_callback = progress_callback
        self.stop_words = set(stopwords.words('english'))

    async def generate_qa_pairs(self, documents):
        all_qa_pairs = []
        total_documents = len(documents)
        tasks = []
        for i, doc in enumerate(documents):
            task = asyncio.create_task(self._generate_qa_pairs_for_document(doc, i, total_documents))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        for qa_pairs in results:
            all_qa_pairs.extend(qa_pairs)
        
        return all_qa_pairs

    async def _generate_qa_pairs_for_document(self, doc, index, total_documents):
        qa_pairs = []
        content = doc['content']
        metadata = doc['metadata']
        title = metadata.get('title', 'Document')
        document_id = metadata.get('document_id', '')

        # Flatten the content for easier processing
        sections = self.flatten_content(content)

        for section in sections:
            text = section.get('text', '')
            if not text.strip():
                continue  # Skip sections without text

            # Generate QA pairs using existing logic
            qa_pairs.extend(await self.generate_qa_pairs_for_section(section, title, document_id))

        if self.progress_callback:
            progress = ((index + 1) / total_documents) * 100
            self.progress_callback(progress)

        return qa_pairs

    def flatten_content(self, content):
        # Flatten the hierarchical content to a list of sections
        sections = []

        def traverse(items, parent_titles=[]):
            for item in items:
                current_titles = parent_titles.copy()
                if item.get('type') in ['Part', 'Division', 'Section']:
                    current_titles.append(f"{item.get('type')} {item.get('number', '')} {item.get('title', '')}".strip())
                    item['full_title'] = ' - '.join(current_titles)
                    sections.append(item)
                if 'content' in item:
                    traverse(item['content'], current_titles)
                elif 'subcontent' in item:
                    traverse(item['subcontent'], current_titles)

        traverse(content.get('content', []))
        return sections

    async def generate_qa_pairs_for_section(self, section, document_title, document_id):
        qa_pairs = []
        text = section.get('text', '')
        if not text.strip():
            return qa_pairs

        sentences = sent_tokenize(text)
        if not sentences:
            return qa_pairs

        section_title = section.get('full_title', '')

        # Generate question about the section's purpose
        purpose_question = f"What is the purpose of {section_title} in the {document_title}?"
        purpose_answer = f"The purpose of {section_title} in the {document_title} is to {sentences[0].lower()}"
        qa_pairs.append(self._create_qa_pair(purpose_question, purpose_answer, section_title, document_title, document_id))

        # Generate questions about key terms or definitions
        key_terms = await self._extract_key_terms(text)
        for term in key_terms[:3]:
            term_question = f"How does the {document_title} define or describe '{term}' in {section_title}?"
            term_answer = self._find_sentence_with_term(sentences, term)
            qa_pairs.append(self._create_qa_pair(term_question, term_answer, section_title, document_title, document_id))

        # Generate a question about the main provision or requirement
        provision_question = f"What is the main provision stated in {section_title} of the {document_title}?"
        provision_answer = ' '.join(sentences[:2])  # Use first two sentences as the answer
        qa_pairs.append(self._create_qa_pair(provision_question, provision_answer, section_title, document_title, document_id))

        return qa_pairs

    async def _extract_key_terms(self, text):
        words = word_tokenize(text.lower())
        word_freq = nltk.FreqDist(word for word in words if word.isalnum() and word not in self.stop_words)
        return [word for word, _ in word_freq.most_common(10)]

    def _find_sentence_with_term(self, sentences, term):
        for sentence in sentences:
            if term.lower() in sentence.lower():
                return sentence
        return sentences[0] if sentences else ""

    def _create_qa_pair(self, question, answer, section_title, document_title, document_id):
        return {
            'question': question,
            'answer': f"{answer} [Source: {document_title}, Section: {section_title}]",
            'source': {
                'document_id': document_id,
                'section_title': section_title,
                'document_title': document_title
            }
        }
