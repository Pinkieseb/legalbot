import aiohttp
import asyncio
import json
import os
from datetime import datetime, timedelta

class APIClient:
    BASE_URL = 'https://www.legislation.vic.gov.au/api/tide/elasticsearch/elasticsearch_index_production_node/_search'
    HEADERS = {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': 'https://www.legislation.vic.gov.au',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Brave";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    }

    def __init__(self, progress_callback=None):
        self.session = None
        self.progress_callback = progress_callback

    async def fetch_all_data(self, data_type, start_page=0):
        cached_data = self.load_cached_data(data_type)
        if cached_data:
            return cached_data

        self.session = aiohttp.ClientSession()
        all_data = []
        page = start_page
        total_items = None

        while total_items is None or len(all_data) < total_items:
            data = await self.fetch_page(data_type, page)
            if total_items is None:
                total_items = data['hits']['total']['value']

            all_data.extend(data['hits']['hits'])
            if self.progress_callback:
                progress = (len(all_data) / total_items) * 100
                self.progress_callback(progress)
            page += 1

        await self.session.close()
        self.save_cached_data(data_type, all_data)
        return all_data

    async def fetch_page(self, data_type, page):
        payload = self.get_payload(data_type, page)
        referer = f'https://www.legislation.vic.gov.au/in-force/{"statutory-rules" if data_type == "statutory_rules" else "acts"}'
        headers = {**self.HEADERS, 'referer': referer}

        async with self.session.post(self.BASE_URL, json=payload, headers=headers) as response:
            return await response.json()

    def get_payload(self, data_type, page):
        base_payload = {
            "query": {
                "function_score": {
                    "query": {
                        "bool": {
                            "must": [{"bool": {"should": {"bool": {"must": {"match_all": {}}}},"minimum_should_match": 1}}],
                            "filter": {
                                "bool": {
                                    "filter": [
                                        {"terms": {"field_act_sr_status": [False]}},
                                        {"terms": {"field_node_site": [6]}}
                                    ]
                                }
                            }
                        }
                    },
                    "functions": [
                        {"filter": {"term": {"legislation_type": "act_in_force"}}, "weight": 7},
                        {"filter": {"term": {"legislation_type": "sr_in_force"}}, "weight": 6},
                        {"filter": {"term": {"legislation_type": "act_as_made"}}, "weight": 5},
                        {"filter": {"term": {"legislation_type": "sr_as_made"}}, "weight": 4},
                        {"filter": [{"term": {"legislation_type": "bill"}}, {"term": {"field_bill_parliament_current": True}}], "weight": 3},
                        {"filter": {"term": {"legislation_type": "repealed_act"}}, "weight": 2},
                        {"filter": {"term": {"legislation_type": "revoked_sr"}}, "weight": 1},
                        {"filter": [{"term": {"legislation_type": "bill"}}, {"term": {"field_bill_parliament_current": False}}], "weight": 1}
                    ],
                    "score_mode": "sum"
                }
            },
            "size": 40,
            "from": page * 40,
            "sort": [{"_score": "desc"}, {"title_az": "asc"}]
        }

        if data_type == "statutory_rules":
            base_payload["query"]["function_score"]["query"]["bool"]["filter"]["bool"]["filter"].append({"terms": {"type": ["sr_in_force"]}})
        elif data_type == "acts":
            base_payload["query"]["function_score"]["query"]["bool"]["filter"]["bool"]["filter"].append({"terms": {"type": ["act_in_force"]}})

        return base_payload

    def save_cached_data(self, data_type, data):
        os.makedirs('./storage', exist_ok=True)
        file_path = f'./storage/{data_type}_cache.json'
        with open(file_path, 'w') as f:
            json.dump({'timestamp': datetime.now().isoformat(), 'data': data}, f)

    def load_cached_data(self, data_type):
        file_path = f'./storage/{data_type}_cache.json'
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                cache = json.load(f)
            cache_time = datetime.fromisoformat(cache['timestamp'])
            if datetime.now() - cache_time < timedelta(days=1):
                return cache['data']
        return None
