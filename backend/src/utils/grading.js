const GRADE_SCALE = ['AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD', 'DE', 'F'];

const DEFAULT_GRADE_RANGES = [
    { grade_code: 'AA', min_score: 90, max_score: 100 },
    { grade_code: 'AB', min_score: 80, max_score: 89.99 },
    { grade_code: 'BB', min_score: 70, max_score: 79.99 },
    { grade_code: 'BC', min_score: 60, max_score: 69.99 },
    { grade_code: 'CC', min_score: 50, max_score: 59.99 },
    { grade_code: 'CD', min_score: 45, max_score: 49.99 },
    { grade_code: 'DD', min_score: 40, max_score: 44.99 },
    { grade_code: 'DE', min_score: 35, max_score: 39.99 },
    { grade_code: 'F', min_score: 0, max_score: 34.99 },
];

function roundTo(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function calculateMedian(values = []) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? roundTo((sorted[middle - 1] + sorted[middle]) / 2)
        : roundTo(sorted[middle]);
}

function calculateStdDev(values = []) {
    if (!values.length) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    return roundTo(Math.sqrt(variance));
}

function buildDefaultComponents(exams = []) {
    if (!exams.length) return [];
    const evenWeight = 100 / exams.length;

    return exams.map((exam, index) => {
        const isLast = index === exams.length - 1;
        const allocated = roundTo(evenWeight);
        const used = roundTo(allocated * index);
        const weight = isLast ? roundTo(100 - used) : allocated;

        return {
            exam_type: exam.exam_type,
            weight_percentage: weight,
            display_order: index,
        };
    });
}

function normalizeRanges(ranges = []) {
    return ranges
        .map((range, index) => ({
            grade_code: range.grade_code,
            min_score: roundTo(range.min_score),
            max_score: roundTo(range.max_score),
            display_order: Number.isInteger(range.display_order) ? range.display_order : index,
        }))
        .sort((a, b) => a.display_order - b.display_order);
}

function assignGrade(score, ranges = []) {
    const normalizedScore = roundTo(score);
    const orderedRanges = normalizeRanges(ranges);

    for (const range of orderedRanges) {
        if (normalizedScore >= range.min_score && normalizedScore <= range.max_score) {
            return range.grade_code;
        }
    }

    return null;
}

module.exports = {
    GRADE_SCALE,
    DEFAULT_GRADE_RANGES,
    roundTo,
    calculateMedian,
    calculateStdDev,
    buildDefaultComponents,
    normalizeRanges,
    assignGrade,
};
