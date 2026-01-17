# RISC-V Processor Leaderboard

This is a leaderboard for implementing 5-stage pipelined RISC-V (RV32I) processors in undergraduate computer architecture courses. 
The leaderboard can be accessed [here](https://unarylab.github.io/comparch_leaderboard-RISC-V/).

# Usage
To automatically include new data, add new CSV files to the ```./database/```. 
The CSV files shall be named as year-semester-university, and inside including six fields, ***team_name***, ***ipc***, ***cycle_count***, ***frequency_mhz***, ***area_mm2***, ***power_mw***.
Then GithHb workflow will automatically update the leaderboard.

# Contributor
The project was set up by Daniel Price in Spring 2026, during his PhD study in the UnaryLab.
