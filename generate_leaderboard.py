#!/usr/bin/env python3
"""
RISC-V Processor Leaderboard Generator

Writes the two artifacts consumed elsewhere:
  - database/files.json : the CSV file list the web front-end fetches to discover data.
  - README.md           : a generic project/usage page. It intentionally lists NO per-team
                          numbers; the live site (index.html) ranks and renders the data
                          client-side.

Uses only the Python standard library - no external dependencies required.
"""

import json
from pathlib import Path
import argparse

DATABASE_DIR = Path(__file__).parent / "database"


def generate_files_json() -> None:
    """Write database/files.json listing all CSV files for the web interface."""
    csv_files = sorted(f.name for f in DATABASE_DIR.glob("*.csv"))
    files_json_path = DATABASE_DIR / "files.json"
    with open(files_json_path, "w", encoding="utf-8") as f:
        json.dump(csv_files, f)
    print(f"Generated: {files_json_path}")


def generate_full_readme() -> str:
    """Generate the complete README.md content.

    Curated prose only (README.md is fully generated; edit this function, not README.md).
    Keep it generic - no database numbers.
    """
    lines = [
        "# RISC-V Processor Leaderboard",
        "",
        "This is a leaderboard for implementing 5-stage pipelined RISC-V (RV32I) processors "
        "in undergraduate computer architecture courses. ",
        "The leaderboard can be accessed [here](https://unarylab.github.io/comparch_leaderboard-RISC-V/).",
        "",
        "# Usage",
        "To automatically include new data, add new CSV files to the ```./database/```. ",
        "The CSV files shall be named as year-semester-university, and inside including six fields, "
        "***team_name***, ***ipc***, ***cycle_count***, ***frequency_mhz***, ***area_mm2***, ***power_mw***.",
        "Then GitHub workflow will automatically update the leaderboard.",
        "",
        "## Metrics",
        "",
        "| Metric | Description | Better |",
        "|--------|-------------|--------|",
        "| IPC | Instructions Per Cycle | Higher |",
        "| Cycle Count | End-to-end program execution cycles | Lower |",
        "| Frequency | Hardware synthesis frequency (MHz) | Higher |",
        "| Area | Chip area (mm²) | Lower |",
        "| Power | Power consumption (mW) | Lower |",
        "",
        "# Contributor",
        "The project was set up by Daniel Price in Spring 2026, during his PhD study in the UnaryLab.",
        "",
        "Contributors:",
        "- Daniel Price (UCF)",
        "- Colin Maggard (UW-Madison)",
        "- Amulya Bhat (VITV/IITM/UCF)",
        "- Angel Bercian (UCF)",
        "- Fabian Nunez (UCF)",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate RISC-V Processor Leaderboard")
    parser.add_argument("--output", "-o", default="README.md", help="Output file path")
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
