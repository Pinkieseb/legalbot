import asyncio
import json
import os
from api_client import APIClient
from data_processor import DataProcessor
from qa_generator import QAGenerator
from utils import MultiStageProgressBar

PROGRESS_FILE = 'progress.json'

def save_progress(stage, data):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump({'stage': stage, 'data': data}, f)

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    return None

async def main():
    stages = [
        {'name': 'Fetching data', 'weight': 2},
        {'name': 'Processing data', 'weight': 3},
        {'name': 'Generating QA pairs', 'weight': 3},
        {'name': 'Saving QA pairs', 'weight': 1}
    ]
    progress_bar = MultiStageProgressBar(stages)

    api_client = APIClient(progress_callback=progress_bar.update_stage)
    data_processor = DataProcessor(
        progress_callback=progress_bar.update_stage,
        model_name="gpt2",  # You can change this to a more suitable model
        num_gpus=1  # Adjust this based on your GPU availability
    )
    qa_generator = QAGenerator(progress_callback=progress_bar.update_stage)

    progress = load_progress()
    start_stage = 0
    if progress is not None:
        try:
            start_stage = next(i for i, stage in enumerate(stages) if stage['name'] == progress['stage'])
        except StopIteration:
            print("Invalid progress data. Starting from the beginning.")
            start_stage = 0

    all_data = []
    processed_documents = []
    qa_pairs = []

    for i, stage in enumerate(stages[start_stage:], start=start_stage):
        progress_bar.start_stage(stage['name'])

        if stage['name'] == 'Fetching data':
            # Fetch data asynchronously
            statutory_rules_data = await api_client.fetch_all_data('statutory_rules')
            acts_data = await api_client.fetch_all_data('acts')
            all_data = statutory_rules_data + acts_data
            save_progress(stage['name'], {'all_data': all_data})
            print(f"Fetched {len(all_data)} total documents")

        elif stage['name'] == 'Processing data':
            # Process the fetched data asynchronously
            processed_documents = await data_processor.process_api_responses(all_data)
            save_progress(stage['name'], {'processed_documents': processed_documents})
            print(f"Processed {len(processed_documents)} documents")

        elif stage['name'] == 'Generating QA pairs':
            # Generate QA pairs from the processed documents
            qa_pairs = await qa_generator.generate_qa_pairs(processed_documents)
            save_progress(stage['name'], {'qa_pairs': qa_pairs})
            print(f"Generated {len(qa_pairs)} QA pairs")

        elif stage['name'] == 'Saving QA pairs':
            # Save the generated QA pairs to a file
            await save_qa_pairs(qa_pairs, progress_bar)

        progress_bar.finish_stage()

    progress_bar.print_overall_progress()
    print(f"Processing completed. Generated {len(qa_pairs)} QA pairs.")

    # Clean up the progress file after completion
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)

async def save_qa_pairs(qa_pairs, progress_bar):
    total_qa_pairs = len(qa_pairs)
    with open('qa_pairs.jsonl', 'w', encoding='utf-8') as f:
        for i, qa_pair in enumerate(qa_pairs, 1):
            json.dump(qa_pair, f, ensure_ascii=False)
            f.write('\n')
            progress_bar.update_stage((i / total_qa_pairs) * 100)

if __name__ == "__main__":
    asyncio.run(main())
