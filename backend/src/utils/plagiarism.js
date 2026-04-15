// ============================================================
// Code Plagiarism Detection Pipeline
// ============================================================
// Pipeline: Code → Remove Comments → Normalize → Tokenize → k-grams → Jaccard Similarity
//
// Supports: JavaScript, Python, C/C++, Java
// ============================================================

/**
 * Step 1: Remove comments from code
 * Handles: //, /* *​/, #, ''', """
 */
function removeComments(code) {
    if (!code) return '';
    // Remove multi-line comments /* ... */
    let result = code.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove single-line // comments
    result = result.replace(/\/\/.*$/gm, '');
    // Remove Python # comments
    result = result.replace(/#.*$/gm, '');
    // Remove Python triple-quote docstrings
    result = result.replace(/"""[\s\S]*?"""/g, '');
    result = result.replace(/'''[\s\S]*?'''/g, '');
    return result;
}

/**
 * Step 2: Normalize code structure
 * - Replace variable names with VAR
 * - Replace function names with FUNC
 * - Replace string literals with STR
 * - Replace numbers with NUM
 * - Normalize whitespace
 */
function normalizeCode(code) {
    let normalized = code;

    // Remove string literals (replace with STR token)
    normalized = normalized.replace(/`[\s\S]*?`/g, 'STR');
    normalized = normalized.replace(/"(?:[^"\\]|\\.)*"/g, 'STR');
    normalized = normalized.replace(/'(?:[^'\\]|\\.)*'/g, 'STR');

    // Replace numbers with NUM
    normalized = normalized.replace(/\b0x[0-9a-fA-F]+\b/g, 'NUM');
    normalized = normalized.replace(/\b\d+\.?\d*([eE][+-]?\d+)?\b/g, 'NUM');

    // Normalize variable declarations
    normalized = normalized.replace(/\b(let|const|var|int|float|double|char|long|short|boolean|string)\s+([a-zA-Z_]\w*)/g, '$1 VAR');

    // Normalize function declarations
    normalized = normalized.replace(/\bfunction\s+([a-zA-Z_]\w*)/g, 'function FUNC');
    normalized = normalized.replace(/\bdef\s+([a-zA-Z_]\w*)/g, 'def FUNC');
    normalized = normalized.replace(/\bclass\s+([a-zA-Z_]\w*)/g, 'class CLASS');

    // Normalize parameter names in function signatures
    normalized = normalized.replace(/\(([^)]*)\)/g, (match, params) => {
        const normalizedParams = params.replace(/\b[a-zA-Z_]\w*\b/g, (word) => {
            const keywords = new Set([
                'int', 'float', 'double', 'char', 'long', 'short', 'boolean', 'string',
                'void', 'const', 'let', 'var', 'true', 'false', 'null', 'undefined',
                'VAR', 'NUM', 'STR', 'FUNC', 'CLASS'
            ]);
            return keywords.has(word) ? word : 'PARAM';
        });
        return `(${normalizedParams})`;
    });

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}

/**
 * Step 3: Tokenize the normalized code
 * Splits into meaningful tokens (words and operators)
 */
function tokenize(code) {
    if (!code) return [];
    // Match words, operators, and punctuation
    const tokens = code.match(/\w+|[^\w\s]/g) || [];
    return tokens;
}

/**
 * Step 4: Generate k-grams (shingles)
 * Creates overlapping subsequences of k consecutive tokens
 */
function generateKGrams(tokens, k = 5) {
    const kGrams = new Set();
    if (tokens.length < k) {
        // If code is shorter than k, use the whole sequence
        if (tokens.length > 0) {
            kGrams.add(tokens.join(''));
        }
        return kGrams;
    }
    for (let i = 0; i <= tokens.length - k; i++) {
        const gram = tokens.slice(i, i + k).join('');
        kGrams.add(gram);
    }
    return kGrams;
}

/**
 * Step 5: Compute Jaccard Similarity
 * |A ∩ B| / |A ∪ B|
 */
function computeJaccardSimilarity(set1, set2) {
    if (set1.size === 0 && set2.size === 0) return 0;
    if (set1.size === 0 || set2.size === 0) return 0;

    let intersection = 0;
    const smaller = set1.size <= set2.size ? set1 : set2;
    const larger = set1.size <= set2.size ? set2 : set1;

    for (const item of smaller) {
        if (larger.has(item)) intersection++;
    }

    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
}

/**
 * Full plagiarism detection pipeline
 * Returns similarity score between 0 and 1
 */
exports.calculateSimilarity = (code1, code2) => {
    if (!code1 || !code2) return 0;

    // Pipeline
    const clean1 = removeComments(code1);
    const clean2 = removeComments(code2);

    const norm1 = normalizeCode(clean1);
    const norm2 = normalizeCode(clean2);

    const tokens1 = tokenize(norm1);
    const tokens2 = tokenize(norm2);

    // Use k=5 for structural similarity
    const kGrams1 = generateKGrams(tokens1, 5);
    const kGrams2 = generateKGrams(tokens2, 5);

    return computeJaccardSimilarity(kGrams1, kGrams2);
};

/**
 * Check if a file is a code file (supported for plagiarism check)
 */
exports.isCodeFile = (filename) => {
    const codeExtensions = [
        '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
        '.cs', '.rb', '.go', '.rs', '.php', '.swift', '.kt', '.scala',
        '.html', '.css', '.sql', '.r', '.m', '.lua', '.pl', '.sh'
    ];
    const ext = filename ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : '';
    return codeExtensions.includes(ext);
};

/**
 * Get a human-readable similarity label
 */
exports.getSimilarityLabel = (score) => {
    if (score >= 0.8) return { label: 'High Similarity', level: 'danger' };
    if (score >= 0.5) return { label: 'Moderate Similarity', level: 'warning' };
    if (score >= 0.3) return { label: 'Low Similarity', level: 'info' };
    return { label: 'Unique', level: 'safe' };
};
