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

const GRADE_POINT_MAP = {
    AA: 10,
    AB: 9,
    BB: 8,
    BC: 7,
    CC: 6,
    CD: 5,
    DD: 4,
    DE: 3,
    F: 0,
};

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

function buildCombinedScores({ students = [], exams = [], marksRows = [], schema }) {
    const normalizedSchema = {
        ...schema,
        components: [...(schema.components || [])].sort((a, b) => a.display_order - b.display_order),
        ranges: normalizeRanges(schema.ranges || []),
    };

    const selectedComponents = normalizedSchema.components.filter((component) => Number(component.weight_percentage) > 0);
    const examByType = new Map(exams.map((exam) => [exam.exam_type, exam]));
    const marksByStudent = new Map();

    marksRows.forEach((row) => {
        if (!marksByStudent.has(row.student_id)) {
            marksByStudent.set(row.student_id, new Map());
        }
        marksByStudent.get(row.student_id).set(row.exam_type, row);
    });

    const totalWeight = selectedComponents.reduce((sum, component) => sum + Number(component.weight_percentage), 0);

    return students.map((student) => {
        const studentMarks = marksByStudent.get(student.student_id) || new Map();
        let weightedScore = 0;
        let rawTotal = 0;
        let rawMax = 0;
        let missingComponents = 0;

        const componentBreakdown = selectedComponents.map((component) => {
            const exam = examByType.get(component.exam_type);
            const markEntry = studentMarks.get(component.exam_type);
            const maxMarks = Number(exam?.max_marks || 0);
            const marksObtained = Number(markEntry?.marks_obtained || 0);
            const percentage = maxMarks > 0 ? roundTo((marksObtained / maxMarks) * 100) : 0;
            const contribution = totalWeight > 0
                ? roundTo(percentage * (Number(component.weight_percentage) / totalWeight))
                : 0;

            if (!markEntry) missingComponents += 1;

            rawTotal += marksObtained;
            rawMax += maxMarks;
            weightedScore += contribution;

            return {
                exam_type: component.exam_type,
                weight_percentage: Number(component.weight_percentage),
                max_marks: maxMarks,
                marks_obtained: marksObtained,
                percentage,
                contribution,
                missing: !markEntry,
            };
        });

        const final_percentage = roundTo(weightedScore);
        const grade_code = assignGrade(final_percentage, normalizedSchema.ranges);

        return {
            ...student,
            total_marks_obtained: rawTotal,
            total_max_marks: rawMax,
            final_percentage,
            grade_code,
            missing_components: missingComponents,
            component_breakdown: componentBreakdown,
        };
    }).sort((a, b) => {
        if (b.final_percentage !== a.final_percentage) return b.final_percentage - a.final_percentage;
        return (a.roll_no || '').localeCompare(b.roll_no || '');
    }).map((student, index) => ({
        ...student,
        rank: index + 1,
    }));
}

function buildCombinedAnalytics(combinedScores = []) {
    const scores = combinedScores.map((student) => Number(student.final_percentage || 0));
    const gradeDistribution = Object.fromEntries(GRADE_SCALE.map((grade) => [grade, 0]));

    combinedScores.forEach((student) => {
        if (student.grade_code && gradeDistribution[student.grade_code] !== undefined) {
            gradeDistribution[student.grade_code] += 1;
        }
    });

    const histogram = Array.from({ length: 10 }, (_, index) => {
        const start = index * 10;
        const end = index === 9 ? 100 : (index + 1) * 10;
        const count = scores.filter((score) => (
            index === 9 ? score >= start && score <= end : score >= start && score < end
        )).length;

        return { range: `${start}-${end}`, count };
    });

    return {
        count: combinedScores.length,
        average: scores.length ? roundTo(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
        median: calculateMedian(scores),
        max: scores.length ? roundTo(Math.max(...scores)) : 0,
        min: scores.length ? roundTo(Math.min(...scores)) : 0,
        std_dev: calculateStdDev(scores),
        missing_any_component: combinedScores.filter((student) => student.missing_components > 0).length,
        grade_distribution: gradeDistribution,
        score_distribution: histogram,
    };
}

module.exports = {
    GRADE_SCALE,
    GRADE_POINT_MAP,
    DEFAULT_GRADE_RANGES,
    roundTo,
    calculateMedian,
    calculateStdDev,
    buildDefaultComponents,
    normalizeRanges,
    assignGrade,
    buildCombinedScores,
    buildCombinedAnalytics,
};
