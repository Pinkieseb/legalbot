# content_schema.py

content_schema = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},  # Title of the document
        "type": {"type": "string"},   # Document type, e.g., 'Act', 'Regulation'
        "content": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},  # 'Part', 'Division', 'Section', etc.
                    "number": {"type": "string"},
                    "title": {"type": "string"},
                    "text": {"type": "string"},
                    "content": {
                        "type": "array",
                        "items": {
                            # Define nested sections up to a certain depth
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "number": {"type": "string"},
                                "title": {"type": "string"},
                                "text": {"type": "string"},
                                # You can add more nested levels if needed
                                "content": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "type": {"type": "string"},
                                            "number": {"type": "string"},
                                            "title": {"type": "string"},
                                            "text": {"type": "string"}
                                        },
                                        "required": ["type", "title"]
                                    }
                                }
                            },
                            "required": ["type", "title"]
                        }
                    }
                },
                "required": ["type", "title"]
            }
        }
    },
    "required": ["title", "type", "content"]
}
