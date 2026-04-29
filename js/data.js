// Edit this file to change the cars and tracks shown in the dropdowns.
// Add / remove freely — the UI will re-render automatically.

const CARS = {
    "GT3": [
        "Acura NSX GT3 EVO 22",
        "Audi R8 LMS EVO II GT3",
        "BMW M4 GT3",
        "Chevrolet Corvette Z06 GT3.R",
        "Ferrari 296 GT3",
        "Ford Mustang GT3",
        "Lamborghini Huracán GT3 EVO",
        "McLaren 720S GT3 EVO",
        "Mercedes-AMG GT3 2020",
        "Porsche 911 GT3 R (992)"
    ],
    "GT4": [
        "Aston Martin Vantage GT4",
        "BMW M4 GT4",
        "McLaren 570S GT4",
        "Mercedes-AMG GT4",
        "Porsche 718 Cayman GT4 Clubsport MR"
    ],
    "LMP2": [
        "Dallara P217",
        "Oreca 07"
    ],
    "LMP3": [
        "Ligier JS P320"
    ],
    "Hypercar / GTP": [
        "Acura ARX-06 GTP",
        "BMW M Hybrid V8",
        "Cadillac V-Series.R GTP",
        "Porsche 963 GTP"
    ],
    "TCR": [
        "Audi RS 3 LMS TCR",
        "Honda Civic Type R TCR",
        "Hyundai Elantra N TCR"
    ],
    "Production": [
        "BMW M2 CS Racing",
        "Porsche 911 GT3 Cup (992)",
        "Ferrari 296 Challenge"
    ]
};

const TRACKS = [
    "Autodromo Nazionale Monza",
    "Bathurst (Mount Panorama)",
    "Brands Hatch",
    "Circuit de Spa-Francorchamps",
    "Circuit of the Americas",
    "Daytona International Speedway",
    "Donington Park",
    "Hungaroring",
    "Imola",
    "Indianapolis Motor Speedway",
    "Le Mans (Circuit de la Sarthe)",
    "Long Beach",
    "Mid-Ohio",
    "Nürburgring GP",
    "Nürburgring Nordschleife",
    "Okayama",
    "Oulton Park",
    "Phillip Island",
    "Road America",
    "Road Atlanta",
    "Sebring International Raceway",
    "Silverstone",
    "Snetterton",
    "Sonoma Raceway",
    "Suzuka",
    "Tsukuba",
    "VIR (Virginia International Raceway)",
    "Watkins Glen International",
    "Zandvoort",
    "Zolder"
];

const DRIVER_COLORS = [
    { id: "red",    label: "Red",    hex: "#ef4444" },
    { id: "blue",   label: "Blue",   hex: "#3b82f6" },
    { id: "orange", label: "Orange", hex: "#f97316" },
    { id: "yellow", label: "Yellow", hex: "#eab308" }
];
