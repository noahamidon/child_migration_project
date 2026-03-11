## Author: Noah Amidon
## Purpose: Data Cleaning for Final Project QSS 19

library(tidyverse)
library(lubridate)
library(zipcodeR)

# ── Load & clean ──
raw <- read_csv("indproj2/migrant_kids_data.csv")

df <- raw %>%
  rename(
    id               = ID,
    country          = `Child's Country of Origin`,
    gender           = `Child's Gender`,
    date_entry       = `Child's Date of Entry`,
    date_release     = `Child's Date of Release`,
    sponsor_zip      = `Sponsor Zipcode`,
    sponsor_cat      = `Sponsor Category`,
    sponsor_relation = `Relationship of Sponsor`
  ) %>%
  mutate(
    date_entry   = mdy(date_entry),
    date_release = mdy(date_release),
    days_held    = as.integer(date_release - date_entry),
    year_entry   = year(date_entry),
    ym_release   = floor_date(date_release, "month"),
    sponsor_zip  = str_pad(as.character(sponsor_zip), 5, pad = "0"),
    country_group = case_when(
      country %in% c("Guatemala", "Honduras", "El Salvador", "Mexico") ~ country,
      TRUE ~ "Other"
    ),
    sponsor_cat = as.integer(sponsor_cat)
  )

# ── Summary stats (flat CSV, one row) ──
summary_row <- tibble(
  total_children  = nrow(df),
  n_countries     = n_distinct(df$country),
  n_zips          = n_distinct(df$sponsor_zip, na.rm = TRUE),
  median_days     = median(df$days_held, na.rm = TRUE),
  date_min        = min(df$date_entry, na.rm = TRUE),
  date_max        = max(df$date_entry, na.rm = TRUE),
  pct_male        = mean(df$gender == "M", na.rm = TRUE),
  pct_cat1        = mean(df$sponsor_cat == 1, na.rm = TRUE),
  pct_cat2        = mean(df$sponsor_cat == 2, na.rm = TRUE),
  pct_cat3        = mean(df$sponsor_cat == 3, na.rm = TRUE)
)
write_csv(summary_row, "indproj2/summary_stats.csv")

# ── Beeswarm aggregation (~1 dot per 100 children) ──
beeswarm_agg <- df %>%
  mutate(year_bucket = case_when(
    year_entry <= 2016 ~ "2015-2016",
    year_entry <= 2018 ~ "2017-2018",
    year_entry == 2019 ~ "2019",
    year_entry == 2020 ~ "2020",
    year_entry <= 2022 ~ "2021-2022",
    TRUE               ~ "2023"
  )) %>%
  count(country_group, sponsor_cat, year_bucket, gender, name = "n_children") %>%
  uncount(pmax(1, round(n_children / 100))) %>%
  mutate(dot_id = row_number())

write_csv(beeswarm_agg, "indproj2/beeswarm_agg.csv")

# ── Monthly counts by country + gender ──
monthly_counts <- df %>%
  count(ym_release, country_group, gender, name = "n") %>%
  rename(month = ym_release)
write_csv(monthly_counts, "indproj2/monthly_counts.csv")

# ── Monthly counts by gender only ──
monthly_gender <- df %>%
  count(ym_release, gender, name = "n") %>%
  rename(month = ym_release)
write_csv(monthly_gender, "indproj2/monthly_gender.csv")

# ── Sponsor breakdowns ──
sponsor_overall <- df %>%
  count(sponsor_cat, sponsor_relation) %>%
  arrange(sponsor_cat, desc(n))
write_csv(sponsor_overall, "indproj2/sponsor_breakdown.csv")

sponsor_by_country <- df %>%
  count(country_group, sponsor_cat) %>%
  group_by(country_group) %>%
  mutate(pct = n / sum(n)) %>%
  ungroup()
write_csv(sponsor_by_country, "indproj2/sponsor_by_country.csv")

sponsor_by_year <- df %>%
  count(year_entry, sponsor_cat) %>%
  group_by(year_entry) %>%
  mutate(pct = n / sum(n)) %>%
  ungroup()
write_csv(sponsor_by_year, "indproj2/sponsor_by_year.csv")

sponsor_by_gender <- df %>%
  count(gender, sponsor_cat) %>%
  group_by(gender) %>%
  mutate(pct = n / sum(n)) %>%
  ungroup()
write_csv(sponsor_by_gender, "indproj2/sponsor_by_gender.csv")

# ── ZIP code aggregation with geo lookup ──
zip_geo <- zip_code_db %>%
  select(zipcode, lat, lng, major_city, state) %>%
  rename(sponsor_zip = zipcode)

zip_detail <- df %>%
  count(sponsor_zip, country_group, gender, sponsor_cat, year_entry, name = "n") %>%
  left_join(zip_geo, by = "sponsor_zip") %>%
  filter(!is.na(lat))
write_csv(zip_detail, "indproj2/zip_map_detail.csv")

zip_totals <- df %>%
  count(sponsor_zip, name = "total") %>%
  left_join(zip_geo, by = "sponsor_zip") %>%
  filter(!is.na(lat))
write_csv(zip_totals, "indproj2/zip_totals.csv")

state_totals <- zip_detail %>%
  group_by(state) %>%
  summarise(total = sum(n), .groups = "drop") %>%
  arrange(desc(total))
write_csv(state_totals, "indproj2/state_totals.csv")

# ── Custody duration stats ──
custody_stats <- df %>%
  filter(days_held >= 0, days_held < 365) %>%
  group_by(country_group, year_entry) %>%
  summarise(
    median_days = median(days_held, na.rm = TRUE),
    mean_days   = mean(days_held, na.rm = TRUE),
    p25         = quantile(days_held, 0.25, na.rm = TRUE),
    p75         = quantile(days_held, 0.75, na.rm = TRUE),
    n           = n(),
    .groups     = "drop"
  )
write_csv(custody_stats, "indproj2/custody_duration.csv")




