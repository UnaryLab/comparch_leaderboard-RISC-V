#!/usr/bin/env python3
"""
RISC-V Processor Leaderboard Generator

Generates markdown leaderboard tables from CSV data files.
Supports filtering by year and semester, and ranking within/across semesters.
Uses only Python standard library - no external dependencies required.
"""

import csv
import json
import os
from pathlib import Path
from typing import Optional, List, Dict, Tuple
import argparse


# Metrics configuration: (column_name, display_name, higher_is_better)
METRICS = [
    ("ipc", "IPC", True),
    ("cycle_count", "Cycle Count", False),
    ("frequency_mhz", "Frequency (MHz)", True),
    ("area_mm2", "Area (mm²)", False),
    ("power_mw", "Power (mW)", False),
]

DATABASE_DIR = Path(__file__).parent / "database"


def parse_filename(filename: str) -> Optional[Dict]:
    """Parse year-semester-university from filename."""
    name = filename.replace(".csv", "")
    parts = name.split("-")
    if len(parts) >= 3:
        return {
            "year": parts[0],
            "semester": parts[1],
            "university": "-".join(parts[2:]),
            "full_name": name,
        }
    return None


def load_csv(filepath: Path) -> List[Dict]:
    """Load a CSV file and return list of dictionaries."""
    rows = []
    with open(filepath, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert numeric fields (handle empty values)
            for key in ["ipc", "cycle_count", "frequency_mhz", "area_mm2", "power_mw"]:
                if key in row and row[key].strip():
                    row[key] = float(row[key])
                elif key in row:
                    row[key] = None
            rows.append(row)
    return rows


def load_all_data(
    year_filter: Optional[str] = None,
    semester_filter: Optional[str] = None,
) -> List[Dict]:
    """Load all CSV files from database directory with optional filtering."""
    all_data = []

    for csv_file in DATABASE_DIR.glob("*.csv"):
        info = parse_filename(csv_file.name)
        if info is None:
            continue

        # Apply filters
        if year_filter and info["year"] != year_filter:
            continue
        if semester_filter and info["semester"] != semester_filter:
            continue

        rows = load_csv(csv_file)
        for row in rows:
            row["year"] = info["year"]
            row["semester"] = info["semester"]
            row["university"] = info["university"]
            row["source_file"] = info["full_name"]
            all_data.append(row)

    return all_data


def rank_data(data: List[Dict], metric: str, higher_is_better: bool) -> List[Dict]:
    """Add ranking to data for a specific metric."""
    if not data:
        return data

    # Filter out rows with None values for this metric
    valid_data = [row for row in data if row.get(metric) is not None]
    invalid_data = [row for row in data if row.get(metric) is None]

    if not valid_data:
        # All values are None, assign no rank
        for row in data:
            row[f"{metric}_rank"] = None
        return data

    # Sort by metric value
    sorted_data = sorted(valid_data, key=lambda x: x[metric], reverse=higher_is_better)

    # Assign ranks (handling ties)
    current_rank = 1
    prev_value = None
    for i, row in enumerate(sorted_data):
        if prev_value is not None and row[metric] != prev_value:
            current_rank = i + 1
        row[f"{metric}_rank"] = current_rank
        prev_value = row[metric]

    # Assign no rank to invalid rows
    for row in invalid_data:
        row[f"{metric}_rank"] = None

    return sorted_data + invalid_data


def format_value(value, metric: str) -> str:
    """Format a metric value for display."""
    if value is None:
        return "-"
    if metric == "cycle_count":
        return f"{int(value):,}"
    elif metric in ["ipc", "area_mm2"]:
        return f"{value:.2f}"
    elif metric in ["frequency_mhz", "power_mw"]:
        return f"{value:.0f}"
    return f"{value:.2f}"


def generate_metric_table(
    data: List[Dict],
    metric: str,
    display_name: str,
    higher_is_better: bool,
    show_semester: bool = True,
) -> str:
    """Generate markdown table for a single metric."""
    if not data:
        return f"### {display_name}\n\nNo data available.\n\n"

    # Rank the data
    ranked_data = rank_data(data.copy(), metric, higher_is_better)

    # Build table
    lines = [f"### {display_name}"]
    lines.append("")

    if show_semester:
        lines.append("| Rank | Team | Semester | University | " + display_name + " |")
        lines.append("|------|------|----------|------------|" + "-" * (len(display_name) + 2) + "|")
    else:
        lines.append("| Rank | Team | " + display_name + " |")
        lines.append("|------|------|" + "-" * (len(display_name) + 2) + "|")

    for row in ranked_data:
        rank = row[f"{metric}_rank"]
        # Add medal emoji for top 3, handle None ranks
        if rank is None:
            rank_str = "-"
        elif rank == 1:
            rank_str = "🥇 1"
        elif rank == 2:
            rank_str = "🥈 2"
        elif rank == 3:
            rank_str = "🥉 3"
        else:
            rank_str = str(rank)

        formatted_value = format_value(row[metric], metric)

        if show_semester:
            lines.append(
                f"| {rank_str} | {row['team_name']} | {row['semester'].capitalize()} {row['year']} | {row['university'].upper()} | {formatted_value} |"
            )
        else:
            lines.append(
                f"| {rank_str} | {row['team_name']} | {formatted_value} |"
            )

    lines.append("")
    return "\n".join(lines)


def generate_semester_leaderboard(year: str, semester: str) -> str:
    """Generate leaderboard for a specific semester."""
    data = load_all_data(year_filter=year, semester_filter=semester)

    if not data:
        return f"## {semester.capitalize()} {year}\n\nNo data available for this semester.\n\n"

    lines = [f"## {semester.capitalize()} {year}"]
    lines.append("")

    # Get unique universities
    universities = set(row["university"] for row in data)
    uni_str = ", ".join([u.upper() for u in sorted(universities)])
    lines.append(f"*Universities: {uni_str}*")
    lines.append("")

    for metric, display_name, higher_is_better in METRICS:
        # Make a deep copy of data for each metric
        data_copy = [{**row} for row in data]
        table = generate_metric_table(data_copy, metric, display_name, higher_is_better, show_semester=False)
        lines.append(table)

    return "\n".join(lines)


def generate_overall_leaderboard() -> str:
    """Generate overall leaderboard across all semesters."""
    data = load_all_data()

    if not data:
        return "## All-Time Leaderboard\n\nNo data available.\n\n"

    lines = ["## All-Time Leaderboard"]
    lines.append("")
    lines.append("*Rankings across all semesters*")
    lines.append("")

    for metric, display_name, higher_is_better in METRICS:
        # Make a deep copy of data for each metric
        data_copy = [{**row} for row in data]
        table = generate_metric_table(data_copy, metric, display_name, higher_is_better, show_semester=True)
        lines.append(table)

    return "\n".join(lines)


def get_available_semesters() -> List[Tuple[str, str]]:
    """Get list of available year-semester combinations."""
    semesters = []
    for csv_file in DATABASE_DIR.glob("*.csv"):
        info = parse_filename(csv_file.name)
        if info:
            semesters.append((info["year"], info["semester"]))

    # Sort by year (descending) then semester
    semester_order = {"spring": 0, "summer": 1, "fall": 2}
    semesters.sort(key=lambda x: (-int(x[0]), semester_order.get(x[1], 3)))

    # Remove duplicates while preserving order
    seen = set()
    unique_semesters = []
    for sem in semesters:
        if sem not in seen:
            seen.add(sem)
            unique_semesters.append(sem)

    return unique_semesters


def generate_filter_buttons() -> str:
    """Generate interactive filter section using HTML details/summary."""
    semesters = get_available_semesters()

    lines = ["## Quick Navigation"]
    lines.append("")
    lines.append("| View | Link |")
    lines.append("|------|------|")
    lines.append("| All-Time Rankings | [Jump to All-Time](#all-time-leaderboard) |")

    for year, semester in semesters:
        anchor = f"{semester}-{year}".lower()
        lines.append(f"| {semester.capitalize()} {year} | [Jump to {semester.capitalize()} {year}](#{anchor}) |")

    lines.append("")
    return "\n".join(lines)


def generate_files_json() -> None:
    """Generate files.json listing all CSV files for the web interface."""
    csv_files = sorted([f.name for f in DATABASE_DIR.glob("*.csv")])
    files_json_path = DATABASE_DIR / "files.json"
    with open(files_json_path, "w", encoding="utf-8") as f:
        json.dump(csv_files, f)
    print(f"Generated: {files_json_path}")


def generate_full_readme() -> str:
    """Generate the complete README.md content."""
    lines = ["# RISC-V Processor Leaderboard"]
    lines.append("")
    lines.append("This leaderboard compares 5-stage pipelined RISC-V processor implementations from computer architecture courses.")
    lines.append("")
    lines.append("## Metrics")
    lines.append("")
    lines.append("| Metric | Description | Better |")
    lines.append("|--------|-------------|--------|")
    lines.append("| IPC | Instructions Per Cycle | Higher |")
    lines.append("| Cycle Count | End-to-end program execution cycles | Lower |")
    lines.append("| Frequency | Hardware synthesis frequency (MHz) | Higher |")
    lines.append("| Area | Chip area (mm²) | Lower |")
    lines.append("| Power | Power consumption (mW) | Lower |")
    lines.append("")

    # Navigation
    lines.append(generate_filter_buttons())

    # Overall leaderboard
    lines.append(generate_overall_leaderboard())

    # Per-semester leaderboards
    semesters = get_available_semesters()
    for year, semester in semesters:
        lines.append(generate_semester_leaderboard(year, semester))

    # Footer
    lines.append("---")
    lines.append("")
    lines.append("*Leaderboard auto-generated from data in `/database/` directory.*")
    lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate RISC-V Processor Leaderboard")
    parser.add_argument("--output", "-o", default="README.md", help="Output file path")
    parser.add_argument("--year", "-y", help="Filter by year (for custom output)")
    parser.add_argument("--semester", "-s", help="Filter by semester (for custom output)")
    args = parser.parse_args()

    # Generate files.json for the web interface
    generate_files_json()

    # Generate README.md
    readme_content = generate_full_readme()

    output_path = Path(__file__).parent / args.output
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    print(f"Leaderboard generated: {output_path}")


if __name__ == "__main__":
    main()
