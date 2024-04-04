let selected_dataset = "";
const filename = "";
let selectedDataset = [];
let skyline = [];
let dominatedPoints = [];
let filteredColumns = ["Age"];
let datasetColumns;
let datasetNumericColumns;
async function selectDataset(event) {
    const filename = event.target.value;
    d3.csv(`data/Pokemon.csv`)
        .then((data) => {
            selectedDataset = data;
            datasetColumns = data.columns;
            datasetNumericColumns = datasetColumns
                .filter((column) => filteredColumns.indexOf(column) < 0)
                .filter((column) => {
                    for (var i = 0; i < data.length; i++) {
                        let value = data[i][column];
                        if (!value) continue;
                        if (!isNaN(value)) return true;
                        else return false;
                    }
                });
            console.log(data);
            console.log(datasetColumns);
            console.log(calculateSkylinePoints());
        })
        .catch((e) => {
            console.log(e);
        });
}
function calculateSkylinePoints() {
    skyline = [];
    skyline = selectedDataset.filter(
        (data1) =>
            !selectedDataset
                .filter((data) => data != data1)
                .some((data2) => dominates(data2, data1)),
    );
    // Calculate all dominated points.
    /*
     * row a dominates row b iff:
     * [1]. a_i >= b_i for all columns i
     * [2]. there exists column j where a_j > b_j
     */
    dominatedPoints = selectedDataset.filter((data1) =>
        selectedDataset
            .filter((data) => data != data1)
            .some((data2) => dominates(data2, data1)),
    );
    return { skyline, dominatedPoints };
}
function dominates(point1, point2) {
    return (
        datasetNumericColumns.every(
            (column) => +point1[column] >= +point2[column],
        ) &&
        datasetNumericColumns.some(
            (column) => +point1[column] > +point2[column],
        )
    );
}
