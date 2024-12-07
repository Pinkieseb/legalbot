Legislation Dataset Columns;
Type // Enum of either 'Primary' or 'Secondary'
JurisdictionAbb // The Jurisdiction Abbreviation , eg. CTH , NSW, VIC, etc.
Jurisdiction // The non abbreviated name of the Jurisdiction, eg. Commonwealth of Australia, New South Wales, Victoria, etc.
Date // The date of the legislation, can be null'
Title // The title of the legislation
URL // The URL of the legislation, eg. ["https://www.austlii.edu.au/sites/default/files/legis/cth/consol_act/act1990/"]
ContentTypes // The content types of the legislation, eg. ["RTF", "PDF", "Text"]
DownloadURLs // The download URLs of the legislation, eg. ["https://www.austlii.edu.au/sites/default/files/legis/cth/consol_act/act1990/20190912.pdf"]
DownloadSizes // The download sizes of the legislation, eg. ["86.4 KB", "146 KB", "2.12 KB"]
Content // The plain text content of the legislation
whenScraped // The date and time the legislation was scraped

Index URL Structure;
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/{jurisdiction_abb}/consol_{type}/toc-{page}.html

// {type} is either act for 'primary' legislation, or 'reg' for secondary legislation.
// {page} is every letter A to Z.

Primary Index URLs:
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/cth/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/act/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/nsw/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/nt/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/qld/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/sa/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/tas/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/vic/consol_act/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/wa/consol_act/toc-A.html

Secondary Index URLs:
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/cth/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/act/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/nsw/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/nt/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/qld/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/sa/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/tas/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/vic/consol_reg/toc-A.html
https://www.austlii.edu.au/cgi-bin/viewtoc/au/legis/wa/consol_reg/toc-A.html

Instructions;
1. On each of the pages, for each of the index URLs, the elements ".card a" need to be extracted from the HTML content, you should utilise a modern and fast library for HTML parsing.
2. The card elements will have a href attribute, which is the RELATIVE url of the legislation, and if you extract the text it is title of the legislation.
3. The relative URLs need to be added on to the end of the base url "https://www.austlii.edu.au" to get the full URL of the legislation.
4. At each of the legislation URLs, the content of the page should be parsed to extract the ".side-download a" elements.
5. The download elements will contain a href attribute which is the relative URL to the legislation download, and if you extract the text it will be the download format and size, for example; "RTF format (86.4 KB)", "PDF format (146 KB)", "Plain text (ASCII) (2.12 KB)"
6. The content then must be downloaded from the content url. Ideally, the plain text version will be downloaded, if that is not available, then the element ".the-document" should be extracted as plain text from the legislation page. If this occurs, then the "contentType" will be text, and the "DownloadURL" will be null. 