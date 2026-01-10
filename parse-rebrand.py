#!/usr/bin/env python3
"""
Parse Rebrand Fitness HTML and extract movement data
"""
import json
import re
from bs4 import BeautifulSoup

# Your HTML here - I'll create a sample based on what was provided
html_sample = """<div id="movements-target">...paste your HTML here...</div>"""

# Read from file if provided
import sys
if len(sys.argv) > 1:
    with open(sys.argv[1], 'r') as f:
        html_content = f.read()
else:
    html_content = html_sample

# Parse HTML
soup = BeautifulSoup(html_content, 'html.parser')

# Extract categories
categories = []
sidebar = soup.find('aside', class_='sticky')
if sidebar:
    category_items = sidebar.find_all('li')
    for li in category_items:
        name_elem = li.find('p', class_=re.compile('text-sm'))
        color_input = li.find('input', {'type': 'color'})
        
        if name_elem:
            name = name_elem.get_text(strip=True)
            color = '#FFFFFF'
            
            if color_input:
                style = color_input.get('style', '')
                rgb_match = re.search(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', style)
                if rgb_match:
                    r, g, b = [int(x) for x in rgb_match.groups()]
                    color = f'#{r:02x}{g:02x}{b:02x}'.upper()
            
            categories.append({'name': name, 'color': color})

# Extract movements
movements = []
main_section = soup.find('main', class_='flex-1')
if main_section:
    category_header = main_section.find('h3')
    current_category = category_header.get_text(strip=True) if category_header else 'Unknown'
    
    movement_list = main_section.find('ul', class_='space-y-2')
    if movement_list:
        movement_items = movement_list.find_all('li')
        for idx, li in enumerate(movement_items, 1):
            name_elem = li.find('p', class_=re.compile('text-base'))
            if name_elem:
                movement_name = name_elem.get_text(strip=True)
                # Skip the category name itself if it appears in the list
                if movement_name != current_category:
                    movements.append({
                        'name': movement_name,
                        'categoryName': current_category,
                        'ordinal': idx
                    })

# Output results
print(f"Found {len(categories)} categories")
print(f"Found {len(movements)} movements for '{current_category}'")

print("\n=== CATEGORIES ===")
for cat in categories:
    print(f"{cat['name']}: {cat['color']}")

print(f"\n=== MOVEMENTS for {current_category} ===")
for mov in movements:
    print(f"{mov['ordinal']}. {mov['name']}")

# JSON output
output = {
    'categories': categories,
    'currentCategory': current_category,
    'movements': movements
}

print("\n=== JSON ===")
print(json.dumps(output, indent=2))

