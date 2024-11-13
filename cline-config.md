The application needs to have advanced and robust capabilities, for quickly and efficiently crawling the web and extracting data. 
It should be able to effectively handle job qeueing, retries, rate  limiting, exponential back-off, etc. all automatically and internally.
But it also should be written so that it is extremely easy to create, and implement 'flows' for the crawler to follow. 
For example, one flow might be to go to a specific URL, and extract all of a certain element and then return the extracted data. Then the next stage of the flow, might be to use the extracted data (which in this example would be href urls), and then navigate to each of them and extract a different set of elements from each of the urls. 
It should be incredibly easy to add new flows, and stack them all on top of one another, to create a crawler 'flow' in the src/flows/ directory.


Ensure you follow best practices, integrate all of the utility files and logic into the code where possible in order to follow DRY coding principles. And also ensure that the code is as easy as possible to scale, with more possible future flows.