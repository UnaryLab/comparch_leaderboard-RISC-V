// Configuration
const METRICS = {
    ipc: { name: 'IPC', unit: '', higherIsBetter: true },
    cycle_count: { name: 'Cycle Count', unit: '', higherIsBetter: false },
    frequency_mhz: { name: 'Frequency', unit: 'MHz', higherIsBetter: true },
    area_mm2: { name: 'Area', unit: 'mm²', higherIsBetter: false },
    power_mw: { name: 'Power', unit: 'mW', higherIsBetter: false }
};

// Full label with unit, e.g. "Frequency (MHz)" — used for chart titles/axes
const metricLabel = (m) => m.unit ? `${m.name} (${m.unit})` : m.name;

// Chronological order of academic terms within a calendar year. Covers both
// semester (spring/summer/fall) and quarter (adds winter) systems; unknown
// terms sort last. Used to order the Semester filter and the Semester column.
const TERM_ORDER = { winter: 1, spring: 2, summer: 3, fall: 4 };

let allData = [];
let currentSort = { column: 'ipc', ascending: false }; // Matches default render: IPC, best first
let charts = {};

// Escape user-submitted (CSV/markdown/filename) strings before innerHTML interpolation
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// Parse CSV text to array of objects
function parseCSV(text) {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx];
            });
            // Convert numeric fields (handle empty values)
            ['ipc', 'cycle_count', 'frequency_mhz', 'area_mm2', 'power_mw'].forEach(key => {
                if (row[key] && row[key].trim() !== '') {
                    row[key] = parseFloat(row[key]);
                } else {
                    row[key] = null;
                }
            });
            data.push(row);
        }
    }
    return data;
}

// Handle CSV values with commas inside quotes
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// Parse filename to get year, semester, university
function parseFilename(filename) {
    const name = filename.replace('.csv', '');
    const parts = name.split('-');
    if (parts.length >= 3) {
        return {
            year: parts[0],
            semester: parts[1],
            university: parts.slice(2).join('-').toUpperCase()
        };
    }
    return null;
}

// Fetch the generated file list, then load the CSVs
async function loadAllData() {
    const response = await fetch('database/files.json');
    if (!response.ok) {
        throw new Error(`Failed to fetch database/files.json: HTTP ${response.status}`);
    }
    const csvFiles = await response.json();
    return await loadCSVFiles(csvFiles);
}

// Load CSV files
async function loadCSVFiles(files) {
    const allRows = [];
    const cacheBuster = `cb=${Date.now()}`;
    for (const file of files) {
        try {
            const response = await fetch(`database/${file}?${cacheBuster}`);
            if (!response.ok) continue;

            const text = await response.text();
            const info = parseFilename(file);

            if (info) {
                const rows = parseCSV(text);
                rows.forEach(row => {
                    row.year = info.year;
                    row.semester = info.semester;
                    row.university = info.university;
                });
                allRows.push(...rows);
            }
        } catch (e) {
            console.error(`Failed to load ${file}:`, e);
        }
    }

    return allRows;
}

// Populate filter dropdowns
function populateFilters(data) {
    const years = [...new Set(data.map(d => d.year))].sort().reverse();
    const semesters = [...new Set(data.map(d => d.semester))];

    const yearSelect = document.getElementById('year-filter');
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    const semesterSelect = document.getElementById('semester-filter');
    semesters.sort((a, b) => (TERM_ORDER[a] || 99) - (TERM_ORDER[b] || 99));
    semesters.forEach(sem => {
        const option = document.createElement('option');
        option.value = sem;
        option.textContent = sem.charAt(0).toUpperCase() + sem.slice(1);
        semesterSelect.appendChild(option);
    });

    const universities = [...new Set(data.map(d => d.university))].sort();
    const universitySelect = document.getElementById('university-filter');
    universities.forEach(uni => {
        const option = document.createElement('option');
        option.value = uni;
        option.textContent = uni;
        universitySelect.appendChild(option);
    });
}

// Filter data based on current selections
function filterData(data) {
    const year = document.getElementById('year-filter').value;
    const semester = document.getElementById('semester-filter').value;
    const university = document.getElementById('university-filter').value;

    return data.filter(row => {
        if (year !== 'all' && row.year !== year) return false;
        if (semester !== 'all' && row.semester !== semester) return false;
        if (university !== 'all' && row.university !== university) return false;
        return true;
    });
}

// Format number for display
function formatValue(value, metric) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    if (metric === 'cycle_count') {
        return value.toLocaleString();
    } else if (metric === 'ipc' || metric === 'area_mm2') {
        return value.toFixed(2);
    } else {
        return value.toFixed(0);
    }
}

// Render leaderboard table
function renderTable(data) {
    const container = document.getElementById('leaderboard-content');
    container.classList.remove('loading'); // drop the initial loading padding once real content renders

    if (data.length === 0) {
        container.innerHTML = '<div class="no-data">No data available for the selected filters.</div>';
        return;
    }

    // Sort data by current column
    let sortedData = [...data];
    const sortColumn = currentSort.column;

    if (sortColumn === 'semester') {
        // Sort by year (and semester within year)
        sortedData.sort((a, b) => {
            const yearDiff = parseInt(a.year) - parseInt(b.year);
            if (yearDiff !== 0) {
                return currentSort.ascending ? yearDiff : -yearDiff;
            }
            const semDiff = (TERM_ORDER[a.semester] || 0) - (TERM_ORDER[b.semester] || 0);
            return currentSort.ascending ? semDiff : -semDiff;
        });

        // No meaningful ranking for semester sort
        sortedData.forEach(row => {
            row.rank = '';
        });
    } else if (METRICS[sortColumn]) {
        const ascending = currentSort.ascending;

        // Sort with null values at the end
        sortedData.sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            // Handle null values - put them at the end
            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return 1;
            if (bVal === null) return -1;
            const diff = aVal - bVal;
            return ascending ? diff : -diff;
        });

        // Assign ranks based on current sort (only for non-null values)
        let currentRank = 1;
        let prevValue = null;
        sortedData.forEach((row, idx) => {
            if (row[sortColumn] === null) {
                row.rank = '-';
            } else {
                if (prevValue !== null && row[sortColumn] !== prevValue) {
                    currentRank = idx + 1;
                }
                row.rank = currentRank;
                prevValue = row[sortColumn];
            }
        });
    }

    const year = document.getElementById('year-filter').value;
    const semester = document.getElementById('semester-filter').value;

    // Update title — reflect whichever of year/semester are pinned
    const title = document.getElementById('leaderboard-title');
    const semLabel = semester !== 'all' ? semester.charAt(0).toUpperCase() + semester.slice(1) : '';
    const scope = [semLabel, year !== 'all' ? year : ''].filter(Boolean).join(' ');
    title.textContent = scope ? `${scope} Leaderboard` : 'All-Time Leaderboard';

    // Build table HTML
    let html = '<table><thead><tr>';
    html += '<th class="no-sort">Rank</th>';
    html += '<th class="no-sort">Team</th>';

    // Metric columns (sortable)
    Object.entries(METRICS).forEach(([key, config]) => {
        const isCurrentSort = currentSort.column === key;
        const sortClass = isCurrentSort
            ? (currentSort.ascending ? 'sorted-asc' : 'sorted-desc')
            : '';
        const unitHtml = config.unit ? `<br><span class="th-unit">(${config.unit})</span>` : '';
        html += `<th data-column="${key}" class="${sortClass}">${config.name}${unitHtml}</th>`;
    });

    // Semester at the end (sortable by year)
    const isSemesterSort = currentSort.column === 'semester';
    const semSortClass = isSemesterSort
        ? (currentSort.ascending ? 'sorted-asc' : 'sorted-desc')
        : '';
    html += `<th data-column="semester" class="${semSortClass}">Semester</th>`;

    html += '<th class="no-sort">University</th>';

    html += '</tr></thead><tbody>';

    sortedData.forEach(row => {
        const rankClass = (typeof row.rank === 'number' && row.rank <= 3) ? `rank-${row.rank}` : '';
        let medal = '';
        if (row.rank === 1) medal = '<span class="medal">&#129351;</span> ';
        else if (row.rank === 2) medal = '<span class="medal">&#129352;</span> ';
        else if (row.rank === 3) medal = '<span class="medal">&#129353;</span> ';

        html += '<tr>';
        html += `<td class="rank ${rankClass}">${medal}${row.rank}</td>`;
        html += `<td class="team-name">${escapeHtml(row.team_name)}</td>`;

        Object.keys(METRICS).forEach(key => {
            html += `<td>${formatValue(row[key], key)}</td>`;
        });

        // Semester at the end
        const semDisplay = row.semester.charAt(0).toUpperCase() + row.semester.slice(1);
        html += `<td>${escapeHtml(semDisplay)} ${escapeHtml(row.year)}</td>`;

        html += `<td>${row.university ? escapeHtml(row.university) : '-'}</td>`;

        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Add click handlers for sortable columns
    container.querySelectorAll('th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;
            if (currentSort.column === column) {
                // Toggle direction
                currentSort.ascending = !currentSort.ascending;
            } else {
                // New column - default to best values first (or ascending for semester)
                currentSort.column = column;
                if (column === 'semester') {
                    currentSort.ascending = true; // Oldest first by default
                } else {
                    currentSort.ascending = !METRICS[column].higherIsBetter;
                }
            }
            renderTable(filterData(allData));
        });
    });
}

// Chart colors
const CHART_COLORS = [
    'rgba(37, 99, 235, 0.7)',   // blue
    'rgba(34, 197, 94, 0.7)',   // green
    'rgba(249, 115, 22, 0.7)',  // orange
    'rgba(168, 85, 247, 0.7)',  // purple
    'rgba(236, 72, 153, 0.7)',  // pink
    'rgba(20, 184, 166, 0.7)',  // teal
    'rgba(245, 158, 11, 0.7)',  // amber
    'rgba(239, 68, 68, 0.7)',   // red
    'rgba(99, 102, 241, 0.7)',  // indigo
    'rgba(16, 185, 129, 0.7)',  // emerald
    'rgba(251, 146, 60, 0.7)',  // orange light
    'rgba(139, 92, 246, 0.7)',  // violet
];

// Render point cloud charts
function renderCharts(data) {
    // Destroy existing charts first so empty data clears stale charts
    Object.keys(charts).forEach(key => {
        charts[key].destroy();
        delete charts[key];
    });

    if (data.length === 0) return;

    Object.entries(METRICS).forEach(([key, config]) => {
        const canvas = document.getElementById(`chart-${key}`);
        if (!canvas) return;

        // Prepare data points - each team is a point (filter out null values)
        const validData = data.filter(row => row[key] !== null);
        const chartData = validData.map((row, idx) => ({
            x: idx + 1,
            y: row[key],
            label: row.team_name
        }));

        // Create chart
        charts[key] = new Chart(canvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: metricLabel(config),
                    data: chartData,
                    backgroundColor: validData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
                    borderColor: validData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length].replace('0.7', '1')),
                    borderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: metricLabel(config) + (config.higherIsBetter ? ' (↑ Higher is better)' : ' (↓ Lower is better)'),
                        font: {
                            family: "'Gill Sans', 'Gill Sans MT', Cabin, Calibri, sans-serif",
                            size: 14
                        }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return `${point.label}: ${formatValue(point.y, key)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        min: 0,
                        max: validData.length + 1
                    },
                    y: {
                        title: {
                            display: true,
                            text: metricLabel(config),
                            font: {
                                family: "'Gill Sans', 'Gill Sans MT', Cabin, Calibri, sans-serif"
                            }
                        },
                        ticks: {
                            font: {
                                family: "'Gill Sans', 'Gill Sans MT', Cabin, Calibri, sans-serif"
                            }
                        }
                    }
                }
            }
        });
    });
}

async function fetchSemesterSetup(year, semester, university) {
    const filename = `${year}-${semester}-${university.toLowerCase()}.md`;
    const cacheBuster = `cb=${Date.now()}`;
    try {
        const response = await fetch(`database/${filename}?${cacheBuster}`);
        if (!response.ok) return null;
        const text = await response.text();
        const procMatch = text.match(/### Processor Setup\n([\s\S]*?)(?=###|$)/);
        const workloadMatch = text.match(/### Workload Setup\n([\s\S]*?)(?=###|$)/);
        return {
            year,
            semester,
            university,
            processor: procMatch ? procMatch[1].trim() : '',
            workload: workloadMatch ? workloadMatch[1].trim() : ''
        };
    } catch (e) {
        return null;
    }
}

async function renderSemesterSetups(data) {
    const setups = {};
    const promises = [];
    data.forEach(row => {
        const key = `${row.year}-${row.semester}-${row.university}`;
        if (!setups[key]) {
            setups[key] = null;
            promises.push(
                fetchSemesterSetup(row.year, row.semester, row.university).then(setup => {
                    setups[key] = setup;
                })
            );
        }
    });
    await Promise.all(promises);

    const container = document.getElementById('semester-setups');
    let html = '';
    Object.values(setups).forEach(setup => {
        if (!setup) return;
        html += `<div class="section">
            <h2 class="section-title">${escapeHtml(setup.semester.charAt(0).toUpperCase() + setup.semester.slice(1))} ${escapeHtml(setup.year)} (${escapeHtml(setup.university)}) Setup</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="name">Processor Setup</div>
                    <div class="desc">${setup.processor ? escapeHtml(setup.processor) : '<span style="color:#aaa">N/A</span>'}</div>
                </div>
                <div class="metric-card">
                    <div class="name">Workload Setup</div>
                    <div class="desc">${setup.workload ? escapeHtml(setup.workload) : '<span style="color:#aaa">N/A</span>'}</div>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

// Update display when filters change
async function updateDisplay() {
    currentSort = { column: 'ipc', ascending: false }; // Reset sort when filter changes
    const filtered = filterData(allData);
    await renderSemesterSetups(filtered);
    renderCharts(filtered);
    renderTable(filtered);
}

// Initialize
async function init() {
    try {
        allData = await loadAllData();
    } catch (e) {
        console.error(e);
        document.getElementById('leaderboard-content').innerHTML =
            '<div class="no-data">Failed to load data: database/files.json could not be fetched.</div>';
        return;
    }

    if (allData.length === 0) {
        document.getElementById('leaderboard-content').innerHTML =
            '<div class="no-data">No data found. Please add CSV files to the database directory.</div>';
        return;
    }

    populateFilters(allData);

    // Add event listeners
    document.getElementById('year-filter').addEventListener('change', updateDisplay);
    document.getElementById('semester-filter').addEventListener('change', updateDisplay);
    document.getElementById('university-filter').addEventListener('change', updateDisplay);

    // Initial render
    updateDisplay();
}

init();
