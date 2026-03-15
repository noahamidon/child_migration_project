# Alone in America
### An Interactive Visualization of Unaccompanied Child Migration to the United States

A scrollytelling data visualization project built for QSS 19 at Dartmouth College.

---

## About

This project visualizes data on **553,322 unaccompanied children** who crossed the U.S. border between January 2015 and May 2023, obtained by *The New York Times* from the U.S. Department of Health and Human Services via a Freedom of Information Act request.

The piece explores:
- Where children came from (112 countries of origin)
- Where they were placed (by ZIP code across all 50 states)
- Who sponsored them (parent, relative, or non-relative)
- How long they were held in federal custody
- How trends shifted across 8+ years of changing policy

---

## Features

- **Beeswarm migration animation** — dots flow from countries of origin to U.S. states, color-coded by country
- **Stacked area timeline** — monthly arrivals from 2015–2023 with annotations for key policy events (Title 42, COVID, 2021 spike)
- **Sponsor breakdown charts** — sponsor category trends by country, year, and child gender
- **Interactive choropleth map** — click-to-zoom into states, with ZIP-level bubble overlays and filters for country, year, sponsor type, and gender; toggle between absolute counts and per-100k rates

---

## Data

**Source:** U.S. Department of Health and Human Services, Office of Refugee Resettlement — obtained by *The New York Times* via FOIA request.

**Coverage:** January 2015 – May 2023 | 553,322 children | 112 countries | 12,786 ZIP codes

**Key statistics:**
- Median custody duration: 25 days
- 65.9% male
- Top origin countries: Guatemala, Honduras, El Salvador (~80%+ combined)
- Top placement states: Texas (76,136), California, Florida, New York

Raw data was cleaned and aggregated using R (`data/cleaning.R`) into pre-processed CSVs loaded at runtime.

---

## Tech Stack

| Layer | Tools |
|---|---|
| Visualization | D3.js v7, TopoJSON v3 |
| Narrative | Scrollytelling via IntersectionObserver |
| Mapping | Natural Earth projections, US Atlas, World Atlas |
| Data Processing | R, tidyverse, lubridate, zipcodeR |
| Frontend | Vanilla HTML/CSS/JS (no framework) |

---

## Project Structure

```
├── index.html                      # Main scrollytelling page
├── style.css                       # All styling
├── js/
│   ├── main.js                     # Data loading and module initialization
│   ├── migration.js                # Beeswarm dot migration animation
│   ├── timeline.js                 # Stacked area timeline chart
│   ├── sponsors.js                 # Sponsor category visualizations
│   ├── us_map.js                   # Choropleth + ZIP bubble map
│   ├── scrolly.js                  # Scroll-triggered step detection
│   └── custom-select.js            # Custom dropdown filters
└── data/
    ├── migrant_kids_data.csv       # Raw dataset (553K rows, ~30MB)
    ├── cleaning.R                  # R cleaning script
    └── processed/                  # Pre-aggregated CSVs for visualization
```

---

## Running Locally

This is a fully static site — no backend required. Serve from any local web server:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000` in your browser.

> **Note:** D3 loads CSV files via `fetch`, so a local server is required — opening `index.html` directly will not work.

---

## Credits

- Data: *The New York Times* / U.S. HHS Office of Refugee Resettlement
- Project by Noah Amidon for QSS 19, Dartmouth College
- Inspired by NYT reporting on child migrant labor exploitation

---

*Behind every row is a child.*
