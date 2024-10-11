import asyncio
from data_processor import DataProcessor

async def test_data_processor():
    # Initialize the DataProcessor
    processor = DataProcessor()

    # Test case 1: Short input
    short_text = "This is a short piece of text that should be processed without issues."
    short_result = await processor.structure_content(short_text, "Short Text")
    print("Short text result:", short_result)

    # Test case 2: Medium input
    medium_text = "Section 1. This is the first section of a medium-length text.\n\nSection 2. This is the second section, which contains multiple paragraphs.\n\nParagraph 2.1. This is a subsection of Section 2.\n\nSection 3. This is the final section of the medium-length text."
    medium_result = await processor.structure_content(medium_text, "Medium Text")
    print("Medium text result:", medium_result)

    # Test case 3: Long input (simulated)
    long_text = "Section 1. " + "This is a very long section. " * 1000 + "\n\nSection 2. " + "This is another long section. " * 1000
    long_result = await processor.structure_content(long_text, "Long Text")
    print("Long text result:", long_result)

if __name__ == "__main__":
    asyncio.run(test_data_processor())
