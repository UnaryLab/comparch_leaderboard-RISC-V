# RISC-V Processor Leaderboard

This is a leaderboard for implementing 5-stage pipelined RISC-V (RV32I) processors in undergraduate computer architecture courses. 
The leaderboard can be accessed [here](https://unarylab.github.io/comparch_leaderboard-RISC-V/).

# Usage
To automatically include new data, add new CSV files to the ```./database/```. 
The CSV files shall be named as year-semester-university, and inside including six fields, ***team_name***, ***ipc***, ***cycle_count***, ***frequency_mhz***, ***area_mm2***, ***power_mw***.
Then GitHub workflow will automatically update the leaderboard.

## Metrics

| Metric | Description | Better |
|--------|-------------|--------|
| IPC | Instructions Per Cycle | Higher |
| Cycle Count | End-to-end program execution cycles | Lower |
| Frequency | Hardware synthesis frequency (MHz) | Higher |
| Area | Chip area (mm²) | Lower |
| Power | Power consumption (mW) | Lower |

# Contributor
The project was set up by Daniel Price in Spring 2026, during his PhD study in the UnaryLab.

Contributors:
- Daniel Price (UCF)
- Colin Maggard (UW-Madison)
- Amulya Bhat (VITV/IITM/UCF)
- Angel Bercian (UCF)
- Fabian Nunez (UCF)
