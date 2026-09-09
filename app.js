(function () {
  "use strict";

  const COLORS = {
    ink: "#172126",
    muted: "#758087",
    grid: "#e2e7e9",
    blue: "#2f65a7",
    teal: "#087f73",
    burgundy: "#9a2945",
    paleBlue: "#9cbddd",
    white: "#ffffff",
  };

  const DEFAULTS = {
    frequencyIndex: 6,
    component: "real",
    density: 55,
    strategy: "overlap",
    criterion: "r2",
    windowSize: 80,
    stepSize: 30,
    nodeCount: 18,
    degreeMin: 0,
    degreeMax: 5,
    fixedDegree: 3,
    threshold: 0.99,
    projection: "perspective",
    azimuth: -58,
    elevation: 22,
    zoom: 1,
  };

  const EXAMPLE_DEFAULT_FREQUENCIES = {
    acrylic: 29,
    pitting: 293,
    inhibitor: 3,
  };

  const state = {
    dataset: null,
    result: null,
    derived: null,
    derivedDataset: null,
    derivedKey: null,
    source: "example",
    datasets: {
      example: null,
      experimental: null,
      simulation: null,
    },
    examples: {},
    history: [],
    toastTimer: null,
    view: {
      projection: DEFAULTS.projection,
      azimuth: DEFAULTS.azimuth,
      elevation: DEFAULTS.elevation,
      zoom: DEFAULTS.zoom,
    },
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    datasetSummary: $("#datasetSummary"),
    dataBadge: $("#dataBadge"),
    files: $("#datasetFiles"),
    exampleDataset: $("#exampleDataset"),
    simulatorButton: $("#simulatorButton"),
    simulatorDialog: $("#simulatorDialog"),
    simulatorClose: $("#simulatorClose"),
    simulatorCancel: $("#simulatorCancel"),
    generateSimulation: $("#generateSimulation"),
    simulatorModel: $("#simulatorModel"),
    simulatorDescription: $("#simulatorDescription"),
    simulatorEquation: $("#simulatorEquation"),
    simulatorParameters: $("#simulatorParameters"),
    simDuration: $("#simDuration"),
    simSpectra: $("#simSpectra"),
    simFrequencyMin: $("#simFrequencyMin"),
    simFrequencyMax: $("#simFrequencyMax"),
    simFrequencyCount: $("#simFrequencyCount"),
    simNoise: $("#simNoise"),
    simSeed: $("#simSeed"),
    exportButton: $("#exportButton"),
    resetButton: $("#resetButton"),
    frequency: $("#frequencySlider"),
    frequencyValue: $("#frequencyValue"),
    component: $("#componentSelect"),
    density: $("#spectrumDensity"),
    densityValue: $("#densityValue"),
    overlapControls: $("#overlapControls"),
    chebyshevControls: $("#chebyshevControls"),
    windowSize: $("#windowSize"),
    stepSize: $("#stepSize"),
    nodeCount: $("#nodeCount"),
    degreeRangeControls: $("#degreeRangeControls"),
    fixedDegreeControl: $("#fixedDegreeControl"),
    thresholdControl: $("#thresholdControl"),
    degreeMin: $("#degreeMin"),
    degreeMax: $("#degreeMax"),
    fixedDegree: $("#fixedDegree"),
    threshold: $("#r2Threshold"),
    thresholdValue: $("#thresholdValue"),
    run: $("#runAnalysis"),
    status: $("#analysisStatus"),
    showIso: $("#showIsofrequency"),
    showFit: $("#showFit3d"),
    projection: $("#projectionType"),
    azimuth: $("#azimuth"),
    azimuthValue: $("#azimuthValue"),
    elevation: $("#elevation"),
    elevationValue: $("#elevationValue"),
    zoom: $("#viewZoom"),
    zoomValue: $("#zoomValue"),
    viewReset: $("#viewReset"),
    spectrogramCanvas: $("#spectrogramCanvas"),
    fitCanvas: $("#fitCanvas"),
    residualCanvas: $("#residualCanvas"),
    differentialCanvas: $("#differentialCanvas"),
    relativeCanvas: $("#relativeCanvas"),
    derivedAxisDescription: $("#derivedAxisDescription"),
    differentialFormula: $("#differentialFormula"),
    differentialUnit: $("#differentialUnit"),
    relativeFormula: $("#relativeFormula"),
    relativeUnit: $("#relativeUnit"),
    fitFrequency: $("#fitFrequency"),
    residualScale: $("#residualScale"),
    segmentCount: $("#segmentCount"),
    degreeBars: $("#degreeBars"),
    historyTable: $("#historyTable"),
    clearHistory: $("#clearHistory"),
    toast: $("#toast"),
    metricR2: $("#metricR2"),
    metricRmse: $("#metricRmse"),
    metricMae: $("#metricMae"),
    metricMax: $("#metricMax"),
    metricCoverage: $("#metricCoverage"),
  };

  function normalizeDataset(raw) {
    if (!raw) throw new Error("Brak danych wejściowych.");
    const analysisAxis = raw.analysisAxis === "potential" ? "potential" : "time";
    const displayAxis = raw.displayAxis === "potential" ? "potential" : analysisAxis;
    const potential = raw.potential ? raw.potential.map(Number) : [];
    const potentialAxisMode = raw.potentialAxisMode === "linear-scan" ? "linear-scan" : "measured";
    const potentialAxis = potentialAxisMode === "linear-scan"
      ? linearizedPotentialAxis(potential)
      : potential.slice();
    const dataset = {
      name: raw.name || "Zestaw użytkownika",
      source: raw.source || "Pliki lokalne",
      timeSeconds: raw.timeSeconds.map(Number),
      frequenciesHz: raw.frequenciesHz.map(Number),
      real: raw.real.map((row) => row.map(Number)),
      imag: raw.imag.map((row) => row.map(Number)),
      potential,
      potentialAxis,
      potentialAxisMode,
      current: raw.current ? raw.current.map(Number) : [],
      analysisAxis,
      displayAxis,
      simulation: raw.simulation || null,
    };

    const rows = dataset.real.length;
    const columns = dataset.frequenciesHz.length;
    if (!rows || !columns) throw new Error("Macierze impedancji są puste.");
    if (dataset.imag.length !== rows || dataset.timeSeconds.length !== rows) {
      throw new Error("Niezgodna liczba chwil w plikach re, im i tpi.");
    }
    if ((dataset.analysisAxis === "potential" || dataset.displayAxis === "potential") && dataset.potentialAxis.length !== rows) {
      throw new Error("Niezgodna liczba wartości potencjału w pliku tpi.");
    }
    if (
      dataset.real.some((row) => row.length !== columns) ||
      dataset.imag.some((row) => row.length !== columns)
    ) {
      throw new Error("Liczba częstotliwości nie odpowiada kolumnom macierzy re i im.");
    }
    return dataset;
  }

  function linearizedPotentialAxis(values) {
    const count = values.length;
    if (count < 2) return values.slice();
    const meanIndex = (count - 1) / 2;
    const meanValue = values.reduce((sum, value) => sum + value, 0) / count;
    let covariance = 0;
    let variance = 0;
    for (let index = 0; index < count; index += 1) {
      const centeredIndex = index - meanIndex;
      covariance += centeredIndex * (values[index] - meanValue);
      variance += centeredIndex ** 2;
    }
    const slope = covariance / variance;
    if (!Number.isFinite(slope) || Math.abs(slope) <= Number.EPSILON) return values.slice();
    const intercept = meanValue - slope * meanIndex;
    return values.map((_, index) => intercept + slope * index);
  }

  function datasetAxis(dataset, role = "analysis") {
    const axisKind = role === "display" ? dataset.displayAxis : dataset.analysisAxis;
    if (axisKind === "potential") {
      const values = dataset.potentialAxis;
      const linearScan = dataset.potentialAxisMode === "linear-scan";
      return {
        kind: "potential",
        values,
        symbol: "E",
        unit: "V",
        label: linearScan ? "potencjał skanu" : "potencjał",
        name: linearScan ? "potencjału skanu" : "potencjału",
        csvHeader: "potential_v",
        decimals: 3,
        start: Math.min(...values),
        end: Math.max(...values),
      };
    }
    const values = dataset.timeSeconds.map((value) => value / 3600);
    return {
      kind: "time",
      values,
      symbol: "t",
      unit: "h",
      label: "czas",
      name: "czasu",
      csvHeader: "time_h",
      decimals: 1,
      start: Math.min(...values),
      end: Math.max(...values),
    };
  }

  function currentSettings() {
    const degreeMin = clamp(Math.round(Number(els.degreeMin.value)), 0, 50);
    const degreeMax = clamp(Math.round(Number(els.degreeMax.value)), degreeMin, 50);
    els.degreeMin.value = String(degreeMin);
    els.degreeMax.value = String(degreeMax);
    const fixedDegree = clamp(Math.round(Number(els.fixedDegree.value)), 0, 50);
    els.fixedDegree.value = String(fixedDegree);

    return {
      frequencyIndex: clamp(Math.round(Number(els.frequency.value)), 0, state.dataset.frequenciesHz.length - 1),
      component: els.component.value,
      density: clamp(Math.round(Number(els.density.value)), 20, 140),
      strategy: $("input[name='strategy']:checked").value,
      criterion: $("input[name='criterion']:checked").value,
      windowSize: clamp(Math.round(Number(els.windowSize.value)), 6, state.dataset.real.length),
      stepSize: clamp(Math.round(Number(els.stepSize.value)), 1, state.dataset.real.length),
      nodeCount: clamp(Math.round(Number(els.nodeCount.value)), 4, 80),
      degreeMin,
      degreeMax,
      fixedDegree,
      threshold: clamp(Number(els.threshold.value), 0.9, 0.999),
    };
  }

  function derivedSettingsKey(settings) {
    return JSON.stringify({
      strategy: settings.strategy,
      criterion: settings.criterion,
      windowSize: settings.windowSize,
      stepSize: settings.stepSize,
      nodeCount: settings.nodeCount,
      degreeMin: settings.degreeMin,
      degreeMax: settings.degreeMax,
      fixedDegree: settings.fixedDegree,
      threshold: settings.threshold,
    });
  }

  function runAnalysis({ addHistory = true } = {}) {
    if (!state.dataset) return;
    const settings = currentSettings();
    const analysisAxis = datasetAxis(state.dataset, "analysis");
    const displayAxis = datasetAxis(state.dataset, "display");
    const xValues = analysisAxis.values;
    const real = state.dataset.real.map((row) => row[settings.frequencyIndex]);
    const imag = state.dataset.imag.map((row) => row[settings.frequencyIndex]);

    els.run.disabled = true;
    els.status.textContent = "Obliczanie…";
    const started = performance.now();

    try {
      state.result = analyzeComplexSeries(xValues, real, imag, settings);
      state.result.settings = settings;
      state.result.xValues = xValues;
      state.result.analysisAxis = analysisAxis;
      state.result.displayAxis = displayAxis;
      state.result.displayValues = displayAxis.values;
      state.result.real = real;
      state.result.imag = imag;
      const derivedKey = derivedSettingsKey(settings);
      if (state.derivedDataset !== state.dataset || state.derivedKey !== derivedKey) {
        state.derived = analyzeImpedanceSpectrogram(
          xValues,
          state.dataset.real,
          state.dataset.imag,
          settings,
        );
        state.derivedDataset = state.dataset;
        state.derivedKey = derivedKey;
      }
      const elapsed = performance.now() - started;
      els.status.textContent = `Gotowe · ${state.result.segments.length} segmentów · ${elapsed.toFixed(0)} ms`;
      els.exportButton.disabled = false;
      updateFrequencyLabels();
      renderAll();
      if (addHistory) addHistoryEntry();
    } catch (error) {
      els.status.textContent = "Nie udało się wykonać analizy";
      showToast(error.message || "Błąd obliczeń.", true);
    } finally {
      els.run.disabled = false;
    }
  }

  function analyzeComplexSeries(x, real, imag, settings) {
    const n = x.length;
    const sumReal = new Float64Array(n);
    const sumImag = new Float64Array(n);
    const sumDerivativeReal = new Float64Array(n);
    const sumDerivativeImag = new Float64Array(n);
    const weight = new Float64Array(n);
    const degreeSum = new Float64Array(n);
    const segments = [];

    const ranges = settings.strategy === "overlap"
      ? overlappingRanges(n, settings.windowSize, settings.stepSize)
      : chebyshevRanges(x, settings.nodeCount);

    ranges.forEach(({ indices, start, end }) => {
      if (indices.length < Math.max(2, settings.degreeMin + 1)) return;
      const xSegment = indices.map((index) => x[index]);
      const realSegment = indices.map((index) => real[index]);
      const imagSegment = indices.map((index) => imag[index]);
      const selected = selectPolynomial(xSegment, realSegment, imagSegment, settings);
      if (!selected) return;

      indices.forEach((dataIndex, localIndex) => {
        sumReal[dataIndex] += selected.predReal[localIndex];
        sumImag[dataIndex] += selected.predImag[localIndex];
        sumDerivativeReal[dataIndex] += selected.derivativeReal[localIndex];
        sumDerivativeImag[dataIndex] += selected.derivativeImag[localIndex];
        degreeSum[dataIndex] += selected.degree;
        weight[dataIndex] += 1;
      });

      segments.push({
        start,
        end,
        degree: selected.degree,
        score: selected.score,
        r2: selected.r2,
      });
    });

    const fitReal = Array(n).fill(null);
    const fitImag = Array(n).fill(null);
    const derivativeReal = Array(n).fill(null);
    const derivativeImag = Array(n).fill(null);
    const degreeByPoint = Array(n).fill(null);

    for (let index = 0; index < n; index += 1) {
      if (weight[index] > 0) {
        fitReal[index] = sumReal[index] / weight[index];
        fitImag[index] = sumImag[index] / weight[index];
        derivativeReal[index] = sumDerivativeReal[index] / weight[index];
        derivativeImag[index] = sumDerivativeImag[index] / weight[index];
        degreeByPoint[index] = degreeSum[index] / weight[index];
      }
    }

    const metrics = calculateMetrics(real, imag, fitReal, fitImag);
    return {
      fitReal,
      fitImag,
      derivativeReal: smoothDerivativeSavitzkyGolay(derivativeReal),
      derivativeImag: smoothDerivativeSavitzkyGolay(derivativeImag),
      degreeByPoint,
      segments,
      metrics,
      coveredPoints: weight,
    };
  }

  function smoothDerivativeSavitzkyGolay(values) {
    // Savitzky-Golay: window 21, polyorder 1, mode "interp", as in Python.
    const windowLength = Math.min(21, Math.floor(values.length / 2) * 2 - 1);
    if (windowLength < 3) return values.slice();

    const halfWindow = Math.floor(windowLength / 2);
    const squaredOffsets = windowLength * (windowLength ** 2 - 1) / 12;
    // Match Python's zero-filled filter input while retaining the existing gaps.
    const source = values.map((value) => value === null ? 0 : value);

    return values.map((value, index) => {
      if (value === null) return null;
      const start = Math.max(0, Math.min(index - halfWindow, values.length - windowLength));
      let sum = 0;
      let moment = 0;
      for (let offset = 0; offset < windowLength; offset += 1) {
        sum += source[start + offset];
        moment += (offset - halfWindow) * source[start + offset];
      }
      // Interior samples use the centered mean; edge samples use a linear fit.
      return sum / windowLength + (moment / squaredOffsets) * (index - start - halfWindow);
    });
  }

  function overlappingRanges(length, windowSize, stepSize) {
    const ranges = [];
    for (let start = 0; start < length; start += stepSize) {
      const end = Math.min(start + windowSize, length);
      ranges.push({
        start,
        end: end - 1,
        indices: Array.from({ length: end - start }, (_, offset) => start + offset),
      });
    }
    return ranges;
  }

  function chebyshevRanges(x, nodeCount) {
    const min = x[0];
    const max = x[x.length - 1];
    const nodes = [min, max];
    for (let k = 1; k <= nodeCount; k += 1) {
      const root = Math.cos(((2 * k - 1) * Math.PI) / (2 * nodeCount));
      nodes.push(0.5 * (min + max) + 0.5 * (max - min) * root);
    }
    nodes.sort((a, b) => a - b);

    const unique = nodes.filter((value, index) => index === 0 || Math.abs(value - nodes[index - 1]) > 1e-12);
    const ranges = [];
    for (let segment = 0; segment < unique.length - 1; segment += 1) {
      const a = unique[segment];
      const b = unique[segment + 1];
      const isLast = segment === unique.length - 2;
      const indices = [];
      for (let index = 0; index < x.length; index += 1) {
        if (x[index] >= a && (isLast ? x[index] <= b : x[index] < b)) indices.push(index);
      }
      ranges.push({
        start: indices.length ? indices[0] : 0,
        end: indices.length ? indices[indices.length - 1] : 0,
        indices,
      });
    }
    return ranges;
  }

  function selectPolynomial(x, real, imag, settings) {
    const degrees = settings.criterion === "fixed"
      ? [settings.fixedDegree]
      : Array.from(
          { length: settings.degreeMax - settings.degreeMin + 1 },
          (_, index) => settings.degreeMin + index,
        );

    for (const degree of degrees) {
      if (x.length < degree + 1) continue;
      const candidate = fitComplexPolynomial(x, real, imag, degree);
      if (!candidate) continue;

      const r2Real = coefficientOfDetermination(real, candidate.predReal);
      const r2Imag = coefficientOfDetermination(imag, candidate.predImag);
      const r2Average = 0.5 * (r2Real + r2Imag);
      candidate.r2 = r2Average;
      candidate.score = r2Average;

      if (settings.criterion === "r2") {
        if (r2Average >= settings.threshold) return candidate;
      } else {
        return candidate;
      }
    }
    return null;
  }

  function fitComplexPolynomial(x, real, imag, degree) {
    const min = x[0];
    const max = x[x.length - 1];
    const center = 0.5 * (min + max);
    const scale = Math.max(0.5 * (max - min), Number.EPSILON);
    const normalized = x.map((value) => (value - center) / scale);
    const coefficients = leastSquaresComplexPolynomial(normalized, real, imag, degree);
    if (!coefficients) return null;
    const { coeffReal, coeffImag } = coefficients;

    const predReal = normalized.map((value) => evaluatePolynomial(coeffReal, value));
    const predImag = normalized.map((value) => evaluatePolynomial(coeffImag, value));
    const derivativeCoeffReal = polynomialDerivativeCoefficients(coeffReal);
    const derivativeCoeffImag = polynomialDerivativeCoefficients(coeffImag);
    const derivativeReal = normalized.map((value) => evaluatePolynomial(derivativeCoeffReal, value) / scale);
    const derivativeImag = normalized.map((value) => evaluatePolynomial(derivativeCoeffImag, value) / scale);
    return { degree, coeffReal, coeffImag, predReal, predImag, derivativeReal, derivativeImag };
  }

  function leastSquaresComplexPolynomial(x, real, imag, degree) {
    const size = degree + 1;
    const columns = Array.from({ length: size }, () => Array(x.length).fill(0));

    for (let row = 0; row < x.length; row += 1) {
      columns[0][row] = 1;
      if (size > 1) columns[1][row] = x[row];
      for (let order = 2; order < size; order += 1) {
        columns[order][row] = 2 * x[row] * columns[order - 1][row] - columns[order - 2][row];
      }
    }

    const orthonormal = [];
    const upper = Array.from({ length: size }, () => Array(size).fill(0));
    for (let column = 0; column < size; column += 1) {
      const vector = columns[column].slice();
      for (let pass = 0; pass < 2; pass += 1) {
        for (let previous = 0; previous < column; previous += 1) {
          const projection = dotProduct(orthonormal[previous], vector);
          upper[previous][column] += projection;
          for (let row = 0; row < vector.length; row += 1) {
            vector[row] -= projection * orthonormal[previous][row];
          }
        }
      }
      const norm = Math.sqrt(dotProduct(vector, vector));
      if (!Number.isFinite(norm) || norm < 1e-12) return null;
      upper[column][column] = norm;
      orthonormal.push(vector.map((value) => value / norm));
    }

    const project = (values) => orthonormal.map((column) => dotProduct(column, values));
    const coeffReal = backSubstitution(upper, project(real));
    const coeffImag = backSubstitution(upper, project(imag));
    return coeffReal && coeffImag ? { coeffReal, coeffImag } : null;
  }

  function backSubstitution(matrix, vector) {
    const solution = Array(vector.length).fill(0);
    for (let row = vector.length - 1; row >= 0; row -= 1) {
      let value = vector[row];
      for (let column = row + 1; column < vector.length; column += 1) {
        value -= matrix[row][column] * solution[column];
      }
      if (Math.abs(matrix[row][row]) < 1e-12) return null;
      solution[row] = value / matrix[row][row];
    }
    return solution;
  }

  function dotProduct(left, right) {
    let sum = 0;
    for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index];
    return sum;
  }

  function evaluatePolynomial(coefficients, x) {
    if (!coefficients.length) return 0;
    let result = coefficients[0];
    if (coefficients.length === 1) return result;
    let previous = 1;
    let current = x;
    result += coefficients[1] * current;
    for (let order = 2; order < coefficients.length; order += 1) {
      const next = 2 * x * current - previous;
      result += coefficients[order] * next;
      previous = current;
      current = next;
    }
    return result;
  }

  function polynomialDerivativeCoefficients(coefficients) {
    const degree = coefficients.length - 1;
    if (degree <= 0) return [0];
    const derivative = Array(degree).fill(0);
    derivative[degree - 1] = 2 * degree * coefficients[degree];
    if (degree > 1) derivative[degree - 2] = 2 * (degree - 1) * coefficients[degree - 1];
    for (let order = degree - 3; order >= 0; order -= 1) {
      derivative[order] = derivative[order + 2] + 2 * (order + 1) * coefficients[order + 1];
    }
    derivative[0] *= 0.5;
    return derivative;
  }

  function coefficientOfDetermination(observed, predicted) {
    const mean = observed.reduce((sum, value) => sum + value, 0) / observed.length;
    let residual = 0;
    let total = 0;
    for (let index = 0; index < observed.length; index += 1) {
      residual += (observed[index] - predicted[index]) ** 2;
      total += (observed[index] - mean) ** 2;
    }
    if (total < Number.EPSILON) return residual < Number.EPSILON ? 1 : 0;
    return 1 - residual / total;
  }

  function calculateMetrics(real, imag, fitReal, fitImag) {
    const observedReal = [];
    const observedImag = [];
    const predictedReal = [];
    const predictedImag = [];
    const absoluteErrors = [];

    for (let index = 0; index < real.length; index += 1) {
      if (fitReal[index] === null || fitImag[index] === null) continue;
      observedReal.push(real[index]);
      observedImag.push(imag[index]);
      predictedReal.push(fitReal[index]);
      predictedImag.push(fitImag[index]);
      absoluteErrors.push(Math.hypot(real[index] - fitReal[index], imag[index] - fitImag[index]));
    }

    if (!absoluteErrors.length) {
      return { r2: NaN, r2Real: NaN, r2Imag: NaN, rmse: NaN, mae: NaN, max: NaN, coverage: 0 };
    }
    const r2Real = coefficientOfDetermination(observedReal, predictedReal);
    const r2Imag = coefficientOfDetermination(observedImag, predictedImag);
    const squared = absoluteErrors.reduce((sum, value) => sum + value * value, 0);
    return {
      r2: 0.5 * (r2Real + r2Imag),
      r2Real,
      r2Imag,
      rmse: Math.sqrt(squared / absoluteErrors.length),
      mae: absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length,
      max: Math.max(...absoluteErrors),
      coverage: absoluteErrors.length / real.length,
    };
  }

  function analyzeImpedanceSpectrogram(time, realMatrix, imagMatrix, settings) {
    const rowCount = time.length;
    const frequencyCount = realMatrix[0].length;
    const differentialReal = Array.from({ length: rowCount }, () => Array(frequencyCount).fill(null));
    const differentialImag = Array.from({ length: rowCount }, () => Array(frequencyCount).fill(null));
    const relativeReal = Array.from({ length: rowCount }, () => Array(frequencyCount).fill(null));
    const relativeImag = Array.from({ length: rowCount }, () => Array(frequencyCount).fill(null));

    for (let frequencyIndex = 0; frequencyIndex < frequencyCount; frequencyIndex += 1) {
      const real = realMatrix.map((row) => row[frequencyIndex]);
      const imag = imagMatrix.map((row) => row[frequencyIndex]);
      const analysis = analyzeComplexSeries(time, real, imag, settings);
      for (let row = 0; row < rowCount; row += 1) {
        const derivativeReal = analysis.derivativeReal[row];
        const derivativeImag = analysis.derivativeImag[row];
        if (derivativeReal === null || derivativeImag === null) continue;
        differentialReal[row][frequencyIndex] = derivativeReal;
        differentialImag[row][frequencyIndex] = derivativeImag;

        const denominator = real[row] ** 2 + imag[row] ** 2;
        if (!Number.isFinite(denominator) || denominator <= Number.EPSILON) continue;
        relativeReal[row][frequencyIndex] = (
          derivativeReal * real[row] + derivativeImag * imag[row]
        ) / denominator;
        relativeImag[row][frequencyIndex] = (
          derivativeImag * real[row] - derivativeReal * imag[row]
        ) / denominator;
      }
    }

    return {
      differentialReal,
      differentialImag,
      relativeReal,
      relativeImag,
    };
  }

  function circuitModelDefinition(modelKey) {
    const models = {
      rcr: {
        key: "rcr",
        label: "R₁(C₁R₂)",
        description: "Rezystancja szeregowa oraz jeden pojemnościowy proces relaksacyjny.",
        equation: "Z(ω,t) = R₁(t) + R₂(t) / [1 + jωR₂(t)C₁(t)]",
        parameters: [
          { key: "r1", symbol: "R₁", unit: "Ω·cm²", mode: "linear", start: 100, end: 180, min: 0.000001, max: Infinity, step: 10 },
          { key: "r2", symbol: "R₂", unit: "Ω·cm²", mode: "sigmoid", start: 1500, end: 3500, min: 0.000001, max: Infinity, step: 100 },
          { key: "c1", symbol: "C₁", unit: "µF·cm⁻²", mode: "sinusoidal", start: 50, end: 90, min: 0.000001, max: Infinity, step: 5 },
        ],
      },
      rcrcr: {
        key: "rcrcr",
        label: "R₁(C₁R₂)(C₂R₃)",
        description: "Rezystancja szeregowa oraz dwa nakładające się pojemnościowe procesy relaksacyjne.",
        equation: "Z = R₁ + R₂/(1+jωR₂C₁) + R₃/(1+jωR₃C₂)",
        parameters: [
          { key: "r1", symbol: "R₁", unit: "Ω·cm²", mode: "constant", start: 80, end: 80, min: 0.000001, max: Infinity, step: 10 },
          { key: "r2", symbol: "R₂", unit: "Ω·cm²", mode: "linear", start: 700, end: 1400, min: 0.000001, max: Infinity, step: 100 },
          { key: "c1", symbol: "C₁", unit: "µF·cm⁻²", mode: "constant", start: 20, end: 20, min: 0.000001, max: Infinity, step: 2 },
          { key: "r3", symbol: "R₃", unit: "Ω·cm²", mode: "exponential", start: 2500, end: 6000, min: 0.000001, max: Infinity, step: 100 },
          { key: "c2", symbol: "C₂", unit: "µF·cm⁻²", mode: "sigmoid", start: 120, end: 220, min: 0.000001, max: Infinity, step: 10 },
        ],
      },
      rqr: {
        key: "rqr",
        label: "R₁(Q₁R₂)",
        description: "Rezystancja szeregowa oraz proces dyspersyjny opisany elementem stałofazowym CPE.",
        equation: "Z = R₁ + 1 / [1/R₂ + Q₁(jω)ⁿ¹]",
        parameters: [
          { key: "r1", symbol: "R₁", unit: "Ω·cm²", mode: "constant", start: 100, end: 100, min: 0.000001, max: Infinity, step: 10 },
          { key: "r2", symbol: "R₂", unit: "Ω·cm²", mode: "exponential", start: 1600, end: 4200, min: 0.000001, max: Infinity, step: 100 },
          { key: "q1", symbol: "Q₁", unit: "S·sⁿ·cm⁻²", mode: "linear", start: 0.00008, end: 0.00016, min: 1e-12, max: Infinity, step: 0.00001 },
          { key: "n1", symbol: "n₁", unit: "—", mode: "sigmoid", start: 0.82, end: 0.94, min: 0.1, max: 1, step: 0.01 },
        ],
      },
      randles: {
        key: "randles",
        label: "Randles + W",
        description: "Rezystancja elektrolitu, pojemność warstwy podwójnej oraz gałąź przeniesienia ładunku z dyfuzją Warburga.",
        equation: "Z = Rₛ + 1 / [jωCdl + 1/(Rct + σ(1−j)/√ω)]",
        parameters: [
          { key: "rs", symbol: "Rₛ", unit: "Ω·cm²", mode: "constant", start: 25, end: 25, min: 0.000001, max: Infinity, step: 5 },
          { key: "rct", symbol: "Rct", unit: "Ω·cm²", mode: "sigmoid", start: 500, end: 1800, min: 0.000001, max: Infinity, step: 50 },
          { key: "cdl", symbol: "Cdl", unit: "µF·cm⁻²", mode: "linear", start: 80, end: 130, min: 0.000001, max: Infinity, step: 5 },
          { key: "sigma", symbol: "σ", unit: "Ω·s⁻¹ᐟ²·cm²", mode: "exponential", start: 80, end: 220, min: 0.000001, max: Infinity, step: 10 },
        ],
      },
    };
    return models[modelKey] || models.rcr;
  }

  function simulateCircuitDataset(config) {
    const model = circuitModelDefinition(config.model || "rcr");
    const frequenciesHz = logarithmicSpace(config.frequencyMin, config.frequencyMax, config.frequencyCount);
    const timeSeconds = Array.from(
      { length: config.spectraCount },
      (_, index) => (config.durationHours * 3600 * index) / Math.max(1, config.spectraCount - 1),
    );
    const normalRandom = createNormalRandom(config.seed);
    const noiseFraction = config.noisePercent / 100;
    const parameterSeries = Object.fromEntries(model.parameters.map((parameter) => [parameter.key, []]));
    const real = [];
    const imag = [];

    timeSeconds.forEach((_, timeIndex) => {
      const progress = timeIndex / Math.max(1, timeSeconds.length - 1);
      const parameters = {};
      model.parameters.forEach((definition) => {
        const value = simulationParameterValue(config.parameters[definition.key], progress);
        parameters[definition.key] = value;
        parameterSeries[definition.key].push(value);
      });

      const realRow = [];
      const imagRow = [];
      frequenciesHz.forEach((frequency) => {
        const impedance = circuitImpedance(model.key, parameters, 2 * Math.PI * frequency);
        const baseReal = impedance.real;
        const baseImag = impedance.imag;
        const noiseScale = noiseFraction * Math.hypot(baseReal, baseImag);
        realRow.push(baseReal + normalRandom() * noiseScale);
        imagRow.push(baseImag + normalRandom() * noiseScale);
      });
      real.push(realRow);
      imag.push(imagRow);
    });

    return {
      name: `Symulacja ${model.label}`,
      source: `Model ${model.label}`,
      timeSeconds,
      frequenciesHz,
      real,
      imag,
      simulation: {
        model: model.key,
        config,
        parameterSeries,
      },
    };
  }

  function simulateRcrDataset(config) {
    return simulateCircuitDataset({ ...config, model: config.model || "rcr" });
  }

  function circuitImpedance(modelKey, parameters, omega) {
    if (modelKey === "rcrcr") {
      const first = parallelRcImpedance(parameters.r2, parameters.c1, omega);
      const second = parallelRcImpedance(parameters.r3, parameters.c2, omega);
      return { real: parameters.r1 + first.real + second.real, imag: first.imag + second.imag };
    }
    if (modelKey === "rqr") {
      const phase = parameters.n1 * Math.PI / 2;
      const cpeMagnitude = parameters.q1 * omega ** parameters.n1;
      const admittanceReal = 1 / parameters.r2 + cpeMagnitude * Math.cos(phase);
      const admittanceImag = cpeMagnitude * Math.sin(phase);
      const denominator = admittanceReal ** 2 + admittanceImag ** 2;
      return {
        real: parameters.r1 + admittanceReal / denominator,
        imag: admittanceImag / denominator,
      };
    }
    if (modelKey === "randles") {
      const warburg = parameters.sigma / Math.sqrt(omega);
      const faradaicReal = parameters.rct + warburg;
      const faradaicDenominator = faradaicReal ** 2 + warburg ** 2;
      const admittanceReal = faradaicReal / faradaicDenominator;
      const admittanceImag = warburg / faradaicDenominator + omega * parameters.cdl * 1e-6;
      const denominator = admittanceReal ** 2 + admittanceImag ** 2;
      return {
        real: parameters.rs + admittanceReal / denominator,
        imag: admittanceImag / denominator,
      };
    }
    const branch = parallelRcImpedance(parameters.r2, parameters.c1, omega);
    return { real: parameters.r1 + branch.real, imag: branch.imag };
  }

  function parallelRcImpedance(resistance, capacitanceMicrofarads, omega) {
    const omegaRc = omega * resistance * capacitanceMicrofarads * 1e-6;
    const denominator = 1 + omegaRc ** 2;
    return {
      real: resistance / denominator,
      imag: (resistance * omegaRc) / denominator,
    };
  }

  function representativeFrequency(config) {
    const parameters = {};
    Object.entries(config.parameters).forEach(([key, parameter]) => {
      parameters[key] = simulationParameterValue(parameter, 0.5);
    });
    if (config.model === "rqr") {
      return (1 / (parameters.r2 * parameters.q1)) ** (1 / parameters.n1) / (2 * Math.PI);
    }
    if (config.model === "randles") return 1 / (2 * Math.PI * parameters.rct * parameters.cdl * 1e-6);
    return 1 / (2 * Math.PI * parameters.r2 * parameters.c1 * 1e-6);
  }

  function simulationParameterValue(parameter, progress) {
    const start = parameter.start;
    const end = parameter.end;
    if (parameter.mode === "constant") return start;
    if (parameter.mode === "exponential") return start * (end / start) ** progress;
    if (parameter.mode === "sigmoid") {
      const low = 1 / (1 + Math.exp(5));
      const high = 1 / (1 + Math.exp(-5));
      const value = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
      return start + (end - start) * ((value - low) / (high - low));
    }
    if (parameter.mode === "sinusoidal") {
      return start + (end - start) * (0.5 - 0.5 * Math.cos(2 * Math.PI * progress));
    }
    return start + (end - start) * progress;
  }

  function logarithmicSpace(min, max, count) {
    const ratio = max / min;
    return Array.from({ length: count }, (_, index) => min * ratio ** (index / Math.max(1, count - 1)));
  }

  function createNormalRandom(seed) {
    let randomState = Number(seed) >>> 0;
    let spare = null;
    const uniform = () => {
      randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    return () => {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return value;
      }
      const radius = Math.sqrt(-2 * Math.log(Math.max(uniform(), Number.EPSILON)));
      const angle = 2 * Math.PI * uniform();
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    };
  }

  function renderAll() {
    renderSpectrogram();
    renderFitChart();
    renderResidualChart();
    renderDerivedSpectrograms();
    renderMetrics();
    renderDegrees();
    renderHistory();
  }

  function renderSpectrogram() {
    if (!state.dataset) return;
    const { ctx, width, height } = canvasContext(els.spectrogramCanvas);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, width, height);

    const data = state.dataset;
    const settings = currentSettings();
    const axis = datasetAxis(data, "display");
    const bounds = impedanceBounds(data);
    const projector = createProjector(width, height, { x: 1.35, y: 1, z: 1.75 });

    const project = (real, imag, timeIndex) => {
      return projector({
        x: normalize(real, bounds.minReal, bounds.maxReal),
        y: normalize(imag, bounds.minImag, bounds.maxImag),
        z: normalize(axis.values[timeIndex], axis.start, axis.end),
      });
    };

    draw3dAxes(ctx, projector, { x: "Z′", y: "−Z″", z: axis.symbol }, "z", axis);
    const rowIndices = evenlySpacedIndices(data.real.length, settings.density)
      .map((rowIndex) => ({
        rowIndex,
        depth: projector({ x: 0.5, y: 0.5, z: rowIndex / Math.max(1, data.real.length - 1) }).depth,
      }))
      .sort((left, right) => right.depth - left.depth);
    rowIndices.forEach(({ rowIndex }) => {
      const points = data.frequenciesHz.map((_, frequencyIndex) =>
        project(data.real[rowIndex][frequencyIndex], data.imag[rowIndex][frequencyIndex], rowIndex),
      );
      const amount = rowIndex / Math.max(1, data.real.length - 1);
      ctx.strokeStyle = mixColor(COLORS.paleBlue, COLORS.teal, amount);
      ctx.globalAlpha = 0.5 + 0.32 * amount;
      ctx.lineWidth = 0.8;
      drawPolyline(ctx, points);
    });
    ctx.globalAlpha = 1;

    const frequencyIndex = settings.frequencyIndex;
    if (els.showIso.checked) {
      const step = Math.max(1, Math.floor(data.real.length / 260));
      const points = [];
      for (let row = 0; row < data.real.length; row += step) {
        points.push(project(data.real[row][frequencyIndex], data.imag[row][frequencyIndex], row));
      }
      ctx.strokeStyle = COLORS.teal;
      ctx.lineWidth = 1.8;
      drawPolyline(ctx, points);
    }

    if (els.showFit.checked && state.result) {
      const points = [];
      const step = Math.max(1, Math.floor(data.real.length / 320));
      for (let row = 0; row < state.result.fitReal.length; row += step) {
        if (state.result.fitReal[row] === null) {
          points.push(null);
        } else {
          points.push(project(state.result.fitReal[row], state.result.fitImag[row], row));
        }
      }
      ctx.strokeStyle = COLORS.burgundy;
      ctx.lineWidth = 2.2;
      drawPolyline(ctx, points);
    }
  }

  function renderDerivedSpectrograms() {
    if (!state.derived) return;
    const axis = datasetAxis(state.dataset, "display");
    renderDerivedSpectrogram(
      els.differentialCanvas,
      state.derived.differentialReal,
      state.derived.differentialImag,
      { x: "Z′diff", y: "−Z″diff", z: axis.symbol },
      COLORS.burgundy,
    );
    renderDerivedSpectrogram(
      els.relativeCanvas,
      state.derived.relativeReal,
      state.derived.relativeImag,
      { x: "Re(Zrel)", y: "−Im(Zrel)", z: axis.symbol },
      COLORS.teal,
    );
  }

  function renderDerivedSpectrogram(canvas, realMatrix, imagMatrix, labels, endColor) {
    const { ctx, width, height } = canvasContext(canvas);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, width, height);
    const bounds = matrixBounds(realMatrix, imagMatrix);
    if (!bounds) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Brak punktów spełniających kryterium aproksymacji", width / 2, height / 2);
      return;
    }

    const settings = currentSettings();
    const rowCount = realMatrix.length;
    const axis = datasetAxis(state.dataset, "display");
    const projector = createProjector(width, height, { x: 1.35, y: 1, z: 1.75 });
    const project = (real, imag, rowIndex) => {
      if (real === null || imag === null || !Number.isFinite(real) || !Number.isFinite(imag)) return null;
      return projector({
        x: normalize(real, bounds.minReal, bounds.maxReal),
        y: normalize(imag, bounds.minImag, bounds.maxImag),
        z: normalize(axis.values[rowIndex], axis.start, axis.end),
      });
    };

    draw3dAxes(ctx, projector, labels, "z", axis);
    const rowIndices = evenlySpacedIndices(rowCount, settings.density)
      .map((rowIndex) => ({
        rowIndex,
        depth: projector({ x: 0.5, y: 0.5, z: rowIndex / Math.max(1, rowCount - 1) }).depth,
      }))
      .sort((left, right) => right.depth - left.depth);

    rowIndices.forEach(({ rowIndex }) => {
      const points = realMatrix[rowIndex].map((real, frequencyIndex) =>
        project(real, imagMatrix[rowIndex][frequencyIndex], rowIndex),
      );
      const amount = rowIndex / Math.max(1, rowCount - 1);
      ctx.strokeStyle = mixColor(COLORS.paleBlue, endColor, amount);
      ctx.globalAlpha = 0.5 + 0.32 * amount;
      ctx.lineWidth = 0.85;
      drawPolyline(ctx, points);
    });
    ctx.globalAlpha = 1;

    const selectedFrequency = settings.frequencyIndex;
    const step = Math.max(1, Math.floor(rowCount / 300));
    const selectedPoints = [];
    for (let row = 0; row < rowCount; row += step) {
      selectedPoints.push(project(
        realMatrix[row][selectedFrequency],
        imagMatrix[row][selectedFrequency],
        row,
      ));
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.8;
    drawPolyline(ctx, selectedPoints);
  }

  function matrixBounds(realMatrix, imagMatrix) {
    let minReal = Infinity;
    let maxReal = -Infinity;
    let minImag = Infinity;
    let maxImag = -Infinity;
    for (let row = 0; row < realMatrix.length; row += 1) {
      for (let column = 0; column < realMatrix[row].length; column += 1) {
        const real = realMatrix[row][column];
        const imag = imagMatrix[row][column];
        if (real === null || imag === null || !Number.isFinite(real) || !Number.isFinite(imag)) continue;
        minReal = Math.min(minReal, real);
        maxReal = Math.max(maxReal, real);
        minImag = Math.min(minImag, imag);
        maxImag = Math.max(maxImag, imag);
      }
    }
    if (!Number.isFinite(minReal) || !Number.isFinite(minImag)) return null;
    if (maxReal === minReal) {
      const padding = Math.max(Math.abs(maxReal) * 0.05, 1e-12);
      minReal -= padding;
      maxReal += padding;
    }
    if (maxImag === minImag) {
      const padding = Math.max(Math.abs(maxImag) * 0.05, 1e-12);
      minImag -= padding;
      maxImag += padding;
    }
    return { minReal, maxReal, minImag, maxImag };
  }

  function createProjector(width, height, aspect) {
    const azimuth = (state.view.azimuth * Math.PI) / 180;
    const elevation = (state.view.elevation * Math.PI) / 180;
    const cosAzimuth = Math.cos(azimuth);
    const sinAzimuth = Math.sin(azimuth);
    const cosElevation = Math.cos(elevation);
    const sinElevation = Math.sin(elevation);
    const centerX = width * 0.5;
    const centerY = height * 0.52;
    const scale = Math.min(width, height) * 0.43 * state.view.zoom;
    const cameraDistance = 4;

    return ({ x, y, z }) => {
      const axisX = (x - 0.5) * aspect.x;
      const axisY = (y - 0.5) * aspect.y;
      const axisZ = (z - 0.5) * aspect.z;
      const rotatedX = axisX * cosAzimuth - axisZ * sinAzimuth;
      const azimuthDepth = axisX * sinAzimuth + axisZ * cosAzimuth;
      const rotatedY = axisY * cosElevation + azimuthDepth * sinElevation;
      const depth = -axisY * sinElevation + azimuthDepth * cosElevation;
      const perspective = state.view.projection === "perspective"
        ? cameraDistance / Math.max(1, cameraDistance + depth)
        : 1;
      return {
        x: centerX + rotatedX * scale * perspective,
        y: centerY - rotatedY * scale * perspective,
        depth,
      };
    };
  }

  function draw3dAxes(ctx, projector, labels, valueAxis, axis) {
    const origin = projector({ x: 0, y: 0, z: 0 });
    const endpoints = {
      x: projector({ x: 1.08, y: 0, z: 0 }),
      y: projector({ x: 0, y: 1.08, z: 0 }),
      z: projector({ x: 0, y: 0, z: 1.08 }),
    };
    ctx.strokeStyle = "#96a1a6";
    ctx.fillStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.font = "12px Georgia, serif";
    Object.keys(endpoints).forEach((axis) => {
      const endpoint = endpoints[axis];
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endpoint.x, endpoint.y);
      ctx.stroke();
      drawArrowhead(ctx, origin, endpoint);
      ctx.textAlign = endpoint.x >= origin.x ? "left" : "right";
      ctx.fillText(labels[axis], endpoint.x + (endpoint.x >= origin.x ? 7 : -7), endpoint.y - 5);
    });

    const valueEnd = endpoints[valueAxis];
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${formatNumber(axis.start, axis.decimals)} ${axis.unit}`, origin.x, origin.y + 16);
    ctx.fillText(`${formatNumber(axis.end, axis.decimals)} ${axis.unit}`, valueEnd.x, valueEnd.y + 16);
  }

  function drawArrowhead(ctx, origin, endpoint) {
    const angle = Math.atan2(endpoint.y - origin.y, endpoint.x - origin.x);
    const size = 5;
    ctx.beginPath();
    ctx.moveTo(endpoint.x, endpoint.y);
    ctx.lineTo(endpoint.x - size * Math.cos(angle - Math.PI / 6), endpoint.y - size * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(endpoint.x, endpoint.y);
    ctx.lineTo(endpoint.x - size * Math.cos(angle + Math.PI / 6), endpoint.y - size * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function renderFitChart() {
    if (!state.result) return;
    const { ctx, width, height } = canvasContext(els.fitCanvas);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, width, height);

    const result = state.result;
    const bounds = series3dBounds(result.real, result.imag, result.fitReal, result.fitImag);
    const xValues = result.displayValues;
    const xMin = result.displayAxis.start;
    const xMax = result.displayAxis.end;
    const projector = createProjector(width, height, { x: 1.65, y: 1.05, z: 1.05 });
    const project = (x, real, imag) => projector({
      x: normalize(x, xMin, xMax),
      y: normalize(real, bounds.minReal, bounds.maxReal),
      z: normalize(imag, bounds.minImag, bounds.maxImag),
    });

    draw3dAxes(ctx, projector, { x: result.displayAxis.symbol, y: "Z′", z: "−Z″" }, "x", result.displayAxis);
    const dataStep = Math.max(1, Math.floor(xValues.length / 450));
    const dataPoints = [];
    const fitPoints = [];
    for (let index = 0; index < xValues.length; index += dataStep) {
      dataPoints.push(project(xValues[index], result.real[index], result.imag[index]));
      fitPoints.push(result.fitReal[index] === null
        ? null
        : project(xValues[index], result.fitReal[index], result.fitImag[index]));
    }

    ctx.strokeStyle = COLORS.ink;
    ctx.fillStyle = COLORS.ink;
    ctx.globalAlpha = 0.58;
    ctx.lineWidth = 0.8;
    drawPolyline(ctx, dataPoints);
    const markerStep = Math.max(1, Math.floor(dataPoints.length / 130));
    for (let index = 0; index < dataPoints.length; index += markerStep) {
      ctx.beginPath();
      ctx.arc(dataPoints[index].x, dataPoints[index].y, 1.15, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.burgundy;
    ctx.lineWidth = 2.2;
    drawPolyline(ctx, fitPoints);
    drawFitLegend(ctx);
  }

  function series3dBounds(real, imag, fitReal, fitImag) {
    const realValues = [...real, ...fitReal.filter((value) => value !== null && Number.isFinite(value))];
    const imagValues = [...imag, ...fitImag.filter((value) => value !== null && Number.isFinite(value))];
    return {
      minReal: Math.min(...realValues),
      maxReal: Math.max(...realValues),
      minImag: Math.min(...imagValues),
      maxImag: Math.max(...imagValues),
    };
  }

  function drawFitLegend(ctx) {
    const entries = [
      { color: COLORS.ink, label: "Dane" },
      { color: COLORS.burgundy, label: "Dopasowanie" },
    ];
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    entries.forEach((entry, index) => {
      const y = 17 + index * 16;
      ctx.strokeStyle = entry.color;
      ctx.lineWidth = index === 0 ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(30, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(entry.label, 36, y + 3);
    });
  }

  function renderResidualChart() {
    if (!state.result) return;
    const component = els.component.value;
    const observed = componentValues(state.result.real, state.result.imag, component);
    const fitted = componentValues(state.result.fitReal, state.result.fitImag, component);
    const residuals = observed.map((value, index) => fitted[index] === null ? null : value - fitted[index]);
    drawLineChart(els.residualCanvas, state.result.displayValues, [
      { values: residuals, color: COLORS.blue, width: 1, points: false, alpha: 0.85 },
    ], { component, zeroLine: true, residual: true, axis: state.result.displayAxis });
  }

  function drawLineChart(canvas, x, series, options) {
    const { ctx, width, height } = canvasContext(canvas);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, width, height);
    const margin = { left: 58, right: 18, top: 18, bottom: 38 };
    const plotWidth = Math.max(20, width - margin.left - margin.right);
    const plotHeight = Math.max(20, height - margin.top - margin.bottom);
    const allValues = series.flatMap((item) => item.values.filter((value) => value !== null && Number.isFinite(value)));
    if (!allValues.length) return;

    let min = Math.min(...allValues);
    let max = Math.max(...allValues);
    if (options.zeroLine) {
      const absolute = Math.max(Math.abs(min), Math.abs(max), Number.EPSILON);
      min = -absolute;
      max = absolute;
    } else {
      const padding = Math.max((max - min) * 0.08, Math.abs(max) * 0.01, 1);
      min -= padding;
      max += padding;
    }

    const unit = chooseUnit(Math.max(Math.abs(min), Math.abs(max)));
    const xMin = options.axis.start;
    const xMax = options.axis.end;
    const mapX = (value) => margin.left + normalize(value, xMin, xMax) * plotWidth;
    const mapY = (value) => margin.top + (1 - normalize(value, min, max)) * plotHeight;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Arial";
    for (let tick = 0; tick <= 4; tick += 1) {
      const yValue = min + ((max - min) * tick) / 4;
      const yPixel = mapY(yValue);
      ctx.beginPath();
      ctx.moveTo(margin.left, yPixel);
      ctx.lineTo(width - margin.right, yPixel);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(formatNumber(yValue / unit.scale, 2), margin.left - 8, yPixel + 3);
    }
    for (let tick = 0; tick <= 4; tick += 1) {
      const xValue = xMin + ((xMax - xMin) * tick) / 4;
      const xPixel = mapX(xValue);
      ctx.textAlign = "center";
      ctx.fillText(formatNumber(xValue, options.axis.decimals), xPixel, height - 15);
    }

    if (options.zeroLine) {
      ctx.strokeStyle = "#99a4a9";
      ctx.beginPath();
      ctx.moveTo(margin.left, mapY(0));
      ctx.lineTo(width - margin.right, mapY(0));
      ctx.stroke();
    }

    series.forEach((item) => {
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.color;
      ctx.globalAlpha = item.alpha;
      ctx.lineWidth = item.width;
      const points = item.values.map((value, index) =>
        value === null || !Number.isFinite(value)
          ? null
          : { x: mapX(x[index]), y: mapY(value) },
      );
      drawPolyline(ctx, points);
      if (item.points) {
        const validPoints = points.filter(Boolean);
        const step = Math.max(1, Math.floor(validPoints.length / 220));
        for (let index = 0; index < validPoints.length; index += step) {
          ctx.beginPath();
          ctx.arc(validPoints[index].x, validPoints[index].y, 1.25, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${options.axis.symbol} [${options.axis.unit}]`, margin.left + plotWidth / 2, height - 3);
    ctx.save();
    ctx.translate(11, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${componentLabel(options.component)} [${unit.label}]`, 0, 0);
    ctx.restore();

    if (options.residual) els.residualScale.textContent = unit.label;
  }

  function renderMetrics() {
    if (!state.result) return;
    const metrics = state.result.metrics;
    els.metricR2.textContent = Number.isFinite(metrics.r2) ? metrics.r2.toFixed(5) : "—";
    els.metricRmse.textContent = formatImpedance(metrics.rmse);
    els.metricMae.textContent = formatImpedance(metrics.mae);
    els.metricMax.textContent = formatImpedance(metrics.max);
    els.metricCoverage.textContent = `${formatNumber(metrics.coverage * 100, 1)}%`;
  }

  function renderDegrees() {
    if (!state.result) return;
    const counts = new Map();
    state.result.segments.forEach((segment) => counts.set(segment.degree, (counts.get(segment.degree) || 0) + 1));
    const maxCount = Math.max(1, ...counts.values());
    els.degreeBars.innerHTML = "";
    Array.from(counts.keys()).sort((a, b) => a - b).forEach((degree) => {
      const count = counts.get(degree);
      const row = document.createElement("div");
      row.className = "degree-row";
      row.innerHTML = `
        <span>Stopień ${degree}</span>
        <div class="degree-track"><div class="degree-fill" style="width:${(100 * count) / maxCount}%"></div></div>
        <strong>${count}</strong>
      `;
      els.degreeBars.appendChild(row);
    });
    if (!counts.size) {
      els.degreeBars.innerHTML = '<p class="analysis-status">Brak segmentów spełniających kryterium.</p>';
    }
    els.segmentCount.textContent = `${state.result.segments.length} segmentów`;
  }

  function addHistoryEntry() {
    if (!state.result) return;
    const settings = state.result.settings;
    const entry = {
      strategy: settings.strategy === "overlap" ? "Okna" : "Czebyszew",
      criterion: criterionLabel(settings.criterion),
      r2: state.result.metrics.r2,
      rmse: state.result.metrics.rmse,
    };
    state.history.unshift(entry);
    state.history = state.history.slice(0, 8);
    renderHistory();
  }

  function renderHistory() {
    els.historyTable.innerHTML = "";
    if (!state.history.length) {
      els.historyTable.innerHTML = '<tr class="empty-row"><td colspan="4">Kolejne obliczenia pojawią się tutaj.</td></tr>';
      return;
    }
    state.history.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.strategy}</td>
        <td>${entry.criterion}</td>
        <td>${Number.isFinite(entry.r2) ? entry.r2.toFixed(4) : "—"}</td>
        <td>${formatImpedance(entry.rmse)}</td>
      `;
      els.historyTable.appendChild(row);
    });
  }

  function impedanceBounds(data) {
    let minReal = Infinity;
    let maxReal = -Infinity;
    let minImag = Infinity;
    let maxImag = -Infinity;
    const rowStep = Math.max(1, Math.floor(data.real.length / 300));
    for (let row = 0; row < data.real.length; row += rowStep) {
      for (let column = 0; column < data.frequenciesHz.length; column += 1) {
        minReal = Math.min(minReal, data.real[row][column]);
        maxReal = Math.max(maxReal, data.real[row][column]);
        minImag = Math.min(minImag, data.imag[row][column]);
        maxImag = Math.max(maxImag, data.imag[row][column]);
      }
    }
    return { minReal, maxReal, minImag, maxImag };
  }

  function componentValues(real, imag, component) {
    return real.map((value, index) => {
      const imaginary = imag[index];
      if (value === null || imaginary === null) return null;
      if (component === "imag") return imaginary;
      if (component === "magnitude") return Math.hypot(value, imaginary);
      return value;
    });
  }

  function canvasContext(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    return { ctx, width, height };
  }

  function drawPolyline(ctx, points) {
    if (points.length < 2) return;
    ctx.beginPath();
    let drawing = false;
    for (const point of points) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        drawing = false;
        continue;
      }
      if (!drawing) {
        ctx.moveTo(point.x, point.y);
        drawing = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
  }

  function evenlySpacedIndices(length, count) {
    if (count >= length) return Array.from({ length }, (_, index) => index);
    return Array.from({ length: count }, (_, index) => Math.round((index * (length - 1)) / (count - 1)));
  }

  function mixColor(from, to, amount) {
    const parse = (hex) => [1, 3, 5].map((position) => parseInt(hex.slice(position, position + 2), 16));
    const a = parse(from);
    const b = parse(to);
    const values = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
    return `rgb(${values.join(",")})`;
  }

  function updateDatasetInterface() {
    const data = state.dataset;
    const analysisAxis = datasetAxis(data, "analysis");
    const displayAxis = datasetAxis(data, "display");
    const axisSummary = displayAxis.kind === "time"
      ? `${formatNumber(displayAxis.end - displayAxis.start, 1)} h`
      : `${displayAxis.symbol}: ${formatNumber(displayAxis.start, displayAxis.decimals)}–${formatNumber(displayAxis.end, displayAxis.decimals)} ${displayAxis.unit}`;
    const sampleLabel = displayAxis.kind === "time" ? "chwil" : "punktów";
    els.datasetSummary.textContent = `${data.name} · ${data.real.length} ${sampleLabel} · ${data.frequenciesHz.length} częstotliwości · ${axisSummary}`;
    els.dataBadge.textContent = state.source === "example"
      ? "Przykład"
      : state.source === "simulation" ? "Symulacja" : "Lokalne";
    els.frequency.max = String(data.frequenciesHz.length - 1);
    els.frequency.value = String(Math.min(Number(els.frequency.value), data.frequenciesHz.length - 1));
    updateAxisInterface(analysisAxis, displayAxis);
    updateDataSourceControls();
    updateFrequencyLabels();
  }

  function updateDataSourceControls() {
    $$("input[name='dataSource']").forEach((input) => {
      input.disabled = !state.datasets[input.value];
      input.checked = input.value === state.source;
    });
    els.exampleDataset.disabled = state.source !== "example";
  }

  function updateAxisInterface(analysisAxis, displayAxis) {
    const potential = analysisAxis.kind === "potential";
    els.derivedAxisDescription.textContent = analysisAxis.kind === displayAxis.kind
      ? `pochodne względem ${analysisAxis.name}`
      : `pochodne względem ${analysisAxis.name} · oś: ${displayAxis.label}`;
    els.differentialFormula.innerHTML = `Z<sub>DIFF</sub> = ∂Z/∂${analysisAxis.symbol}`;
    els.relativeFormula.innerHTML = `Z<sub>REL</sub> = (∂Z/∂${analysisAxis.symbol}) / Z`;
    els.differentialUnit.textContent = potential ? "Ω·cm²·V⁻¹" : "Ω·cm²·h⁻¹";
    els.relativeUnit.textContent = potential ? "V⁻¹" : "h⁻¹";
    els.residualCanvas.setAttribute("aria-label", `Reszty aproksymacji względem ${displayAxis.name}`);
  }

  function activateDataset(source, targetFrequency = null) {
    const dataset = state.datasets[source];
    if (!dataset) return;
    state.dataset = dataset;
    state.source = source;
    state.history = [];
    if (Number.isFinite(targetFrequency)) {
      els.frequency.value = String(nearestFrequencyIndex(dataset.frequenciesHz, targetFrequency));
    }
    updateDatasetInterface();
    runAnalysis({ addHistory: false });
  }

  function updateFrequencyLabels() {
    if (!state.dataset) return;
    const index = clamp(Number(els.frequency.value), 0, state.dataset.frequenciesHz.length - 1);
    const frequency = state.dataset.frequenciesHz[index];
    const text = formatFrequency(frequency);
    els.frequencyValue.textContent = text;
    els.fitFrequency.textContent = text;
    els.densityValue.textContent = els.density.value;
    els.thresholdValue.textContent = Number(els.threshold.value).toLocaleString("pl-PL", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }

  function updateConditionalControls() {
    const strategy = $("input[name='strategy']:checked").value;
    const criterion = $("input[name='criterion']:checked").value;
    els.overlapControls.classList.toggle("is-hidden", strategy !== "overlap");
    els.chebyshevControls.classList.toggle("is-hidden", strategy !== "chebyshev");
    els.degreeRangeControls.classList.toggle("is-hidden", criterion === "fixed");
    els.fixedDegreeControl.classList.toggle("is-hidden", criterion !== "fixed");
    els.thresholdControl.classList.toggle("is-hidden", criterion !== "r2");
  }

  function readSimulationSettings() {
    const model = circuitModelDefinition(els.simulatorModel.value);
    const durationHours = readSimulationNumber(els.simDuration, "Czas eksperymentu", 0.1, 10000);
    const spectraCount = Math.round(readSimulationNumber(els.simSpectra, "Liczba widm", 20, 2000));
    const frequencyMin = readSimulationNumber(els.simFrequencyMin, "Minimalna częstotliwość", 0.000001, 10000000);
    const frequencyMax = readSimulationNumber(els.simFrequencyMax, "Maksymalna częstotliwość", 0.000001, 10000000);
    const frequencyCount = Math.round(readSimulationNumber(els.simFrequencyCount, "Liczba częstotliwości", 8, 100));
    const noisePercent = readSimulationNumber(els.simNoise, "Poziom szumu", 0, 20);
    const seed = Math.round(readSimulationNumber(els.simSeed, "Ziarno losowe", 0, 4294967295));
    if (frequencyMax <= frequencyMin) {
      throw new Error("Częstotliwość maksymalna musi być większa od minimalnej.");
    }

    const parameters = {};
    model.parameters.forEach((definition) => {
      const controls = simulationControlsFor(definition.key);
      const start = readSimulationNumber(
        controls.start,
        `Początkowa wartość ${definition.symbol}`,
        definition.min,
        definition.max,
      );
      const end = controls.mode.value === "constant"
        ? start
        : readSimulationNumber(
            controls.end,
            `Końcowa wartość ${definition.symbol}`,
            definition.min,
            definition.max,
          );
      parameters[definition.key] = { mode: controls.mode.value, start, end };
    });

    return {
      model: model.key,
      durationHours,
      spectraCount,
      frequencyMin,
      frequencyMax,
      frequencyCount,
      noisePercent,
      seed,
      parameters,
    };
  }

  function readSimulationNumber(element, label, min, max) {
    const value = Number(element.value);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${label}: podaj wartość z dozwolonego zakresu.`);
    }
    return value;
  }

  function generateSimulatedDataset() {
    try {
      const config = readSimulationSettings();
      const model = circuitModelDefinition(config.model);
      const dataset = normalizeDataset(simulateCircuitDataset(config));
      state.datasets.simulation = dataset;
      els.simulatorDialog.close();
      activateDataset("simulation", representativeFrequency(config));
      showToast(`Wygenerowano spektrogram ${model.label} i wykonano analizę.`);
    } catch (error) {
      showToast(error.message || "Nie udało się wygenerować symulacji.", true);
    }
  }

  function nearestFrequencyIndex(frequencies, target) {
    let nearest = 0;
    let distance = Infinity;
    frequencies.forEach((frequency, index) => {
      const current = Math.abs(Math.log(frequency / target));
      if (current < distance) {
        nearest = index;
        distance = current;
      }
    });
    return nearest;
  }

  function updateSimulationControls() {
    const model = circuitModelDefinition(els.simulatorModel.value);
    model.parameters.forEach((definition) => {
      const controls = simulationControlsFor(definition.key);
      controls.end.disabled = controls.mode.value === "constant";
    });
  }

  function renderSimulatorParameters() {
    const model = circuitModelDefinition(els.simulatorModel.value);
    els.simulatorDescription.textContent = model.description;
    els.simulatorEquation.textContent = model.equation;
    els.simulatorParameters.innerHTML = model.parameters.map((parameter) => {
      const maxAttribute = Number.isFinite(parameter.max) ? ` max="${parameter.max}"` : "";
      return `
        <div class="sim-parameter-grid" role="group" aria-label="Parametr ${parameter.symbol}">
          <strong>${parameter.symbol} <small>${parameter.unit}</small></strong>
          <select data-sim-mode="${parameter.key}" aria-label="Przebieg ${parameter.symbol}">
            <option value="constant">Stały</option>
            <option value="linear">Liniowy</option>
            <option value="exponential">Eksponencjalny (wykładniczy)</option>
            <option value="sigmoid">Sigmoidalny</option>
            <option value="sinusoidal">Sinusoidalny</option>
          </select>
          <input data-sim-start="${parameter.key}" type="number" min="${parameter.min}"${maxAttribute} value="${parameter.start}" step="${parameter.step}" aria-label="Początkowa wartość ${parameter.symbol}" />
          <input data-sim-end="${parameter.key}" type="number" min="${parameter.min}"${maxAttribute} value="${parameter.end}" step="${parameter.step}" aria-label="Końcowa wartość ${parameter.symbol}" />
        </div>
      `;
    }).join("");
    model.parameters.forEach((parameter) => {
      const controls = simulationControlsFor(parameter.key);
      controls.mode.value = parameter.mode;
      controls.mode.addEventListener("change", updateSimulationControls);
    });
    updateSimulationControls();
  }

  function simulationControlsFor(key) {
    return {
      mode: els.simulatorParameters.querySelector(`[data-sim-mode="${key}"]`),
      start: els.simulatorParameters.querySelector(`[data-sim-start="${key}"]`),
      end: els.simulatorParameters.querySelector(`[data-sim-end="${key}"]`),
    };
  }

  async function importDataset(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const findFile = (pattern) => files.find((file) => pattern.test(file.name.toLowerCase()));
    const fileMap = {
      real: findFile(/(^|[^a-z])re([^a-z]|$)/),
      imag: findFile(/(^|[^a-z])im([^a-z]|$)/),
      tpi: findFile(/tpi/),
      frequencies: findFile(/powloki2|powłoki2|powloki|frequency|freq/),
    };
    if (Object.values(fileMap).some((file) => !file)) {
      throw new Error("Wybierz jednocześnie pliki re, im, tpi oraz powloki2.");
    }

    const [realText, imagText, tpiText, frequencyText] = await Promise.all([
      fileMap.real.text(),
      fileMap.imag.text(),
      fileMap.tpi.text(),
      fileMap.frequencies.text(),
    ]);
    const real = parseMatrix(realText);
    const imag = parseMatrix(imagText);
    const tpi = parseMatrix(tpiText);
    const frequencyMatrix = parseMatrix(frequencyText);
    const dataset = normalizeDataset({
      name: "Zestaw użytkownika",
      source: files.map((file) => file.name).join(", "),
      timeSeconds: tpi.map((row) => row[0]),
      potential: tpi.map((row) => row[1]),
      current: tpi.map((row) => row[2]),
      frequenciesHz: frequencyMatrix.slice(1).map((row) => row[0]),
      real,
      imag,
    });
    state.datasets.experimental = dataset;
    activateDataset("experimental");
    showToast("Wczytano zestaw danych lokalnych.");
  }

  function parseMatrix(text) {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/[\s;,]+/).filter(Boolean).map(Number));
    if (!rows.length || rows.some((row) => row.some((value) => !Number.isFinite(value)))) {
      throw new Error("Nie można odczytać wartości liczbowych z jednego z plików.");
    }
    const width = rows[0].length;
    if (rows.some((row) => row.length !== width)) throw new Error("Plik zawiera wiersze o różnej liczbie kolumn.");
    return rows;
  }

  function exportCsv() {
    if (!state.result) return;
    const frequency = state.dataset.frequenciesHz[state.result.settings.frequencyIndex];
    const analysisAxis = state.result.analysisAxis;
    const displayAxis = state.result.displayAxis;
    const axisColumns = [{ header: analysisAxis.csvHeader, values: state.result.xValues }];
    if (displayAxis.kind !== analysisAxis.kind) {
      axisColumns.push({ header: displayAxis.csvHeader, values: state.result.displayValues });
    }
    const lines = [
      [...axisColumns.map((column) => column.header), "frequency_hz", "re_z", "im_z", "re_fit", "im_fit", "absolute_residual", "mean_degree"].join(","),
    ];
    for (let index = 0; index < state.result.xValues.length; index += 1) {
      const fitReal = state.result.fitReal[index];
      const fitImag = state.result.fitImag[index];
      const residual = fitReal === null ? "" : Math.hypot(
        state.result.real[index] - fitReal,
        state.result.imag[index] - fitImag,
      );
      lines.push([
        ...axisColumns.map((column) => column.values[index]),
        frequency,
        state.result.real[index],
        state.result.imag[index],
        fitReal ?? "",
        fitImag ?? "",
        residual,
        state.result.degreeByPoint[index] ?? "",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `deis-fit-${String(frequency).replace(".", "_")}Hz.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Wyeksportowano wyniki analizy.");
  }

  function resetApplication() {
    if (els.simulatorDialog.open) els.simulatorDialog.close();
    applyDefaults();
    updateConditionalControls();
    els.exampleDataset.value = "acrylic";
    state.datasets.example = state.examples.acrylic;
    activateDataset("example");
    showToast("Przywrócono dane i ustawienia referencyjne.");
  }

  function applyDefaults() {
    els.frequency.value = String(DEFAULTS.frequencyIndex);
    els.component.value = DEFAULTS.component;
    els.density.value = String(DEFAULTS.density);
    els.windowSize.value = String(DEFAULTS.windowSize);
    els.stepSize.value = String(DEFAULTS.stepSize);
    els.nodeCount.value = String(DEFAULTS.nodeCount);
    els.degreeMin.value = String(DEFAULTS.degreeMin);
    els.degreeMax.value = String(DEFAULTS.degreeMax);
    els.fixedDegree.value = String(DEFAULTS.fixedDegree);
    els.threshold.value = String(DEFAULTS.threshold);
    state.view = {
      projection: DEFAULTS.projection,
      azimuth: DEFAULTS.azimuth,
      elevation: DEFAULTS.elevation,
      zoom: DEFAULTS.zoom,
    };
    syncViewControls();
    $$("input[name='strategy']").forEach((input) => { input.checked = input.value === DEFAULTS.strategy; });
    $$("input[name='criterion']").forEach((input) => { input.checked = input.value === DEFAULTS.criterion; });
  }

  function showToast(message, isError = false) {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.classList.toggle("is-error", isError);
    els.toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 3200);
  }

  function formatFrequency(value) {
    if (value >= 1000) return `${formatNumber(value / 1000, value % 1000 === 0 ? 0 : 3)} kHz`;
    return `${formatNumber(value, Number.isInteger(value) ? 0 : 2)} Hz`;
  }

  function formatImpedance(value) {
    if (!Number.isFinite(value)) return "—";
    const unit = chooseUnit(Math.abs(value));
    return `${formatNumber(value / unit.scale, 3)} ${unit.short}`;
  }

  function chooseUnit(value) {
    if (value >= 1e6) return { scale: 1e6, label: "MΩ·cm²", short: "MΩ" };
    if (value >= 1e3) return { scale: 1e3, label: "kΩ·cm²", short: "kΩ" };
    return { scale: 1, label: "Ω·cm²", short: "Ω" };
  }

  function componentLabel(component) {
    if (component === "imag") return "−Z″";
    if (component === "magnitude") return "|Z|";
    return "Z′";
  }

  function criterionLabel(criterion) {
    if (criterion === "fixed") return "Stały";
    return "Próg R²";
  }

  function formatNumber(value, digits) {
    return Number(value).toLocaleString("pl-PL", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalize(value, min, max) {
    return (value - min) / Math.max(max - min, Number.EPSILON);
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function syncViewControls() {
    els.projection.value = state.view.projection;
    els.azimuth.value = String(Math.round(state.view.azimuth));
    els.elevation.value = String(Math.round(state.view.elevation));
    els.zoom.value = String(state.view.zoom);
    els.azimuthValue.textContent = `${Math.round(state.view.azimuth)}°`;
    els.elevationValue.textContent = `${Math.round(state.view.elevation)}°`;
    els.zoomValue.textContent = `${Math.round(state.view.zoom * 100)}%`;
  }

  function updateViewFromControls() {
    state.view.projection = els.projection.value;
    state.view.azimuth = clamp(Number(els.azimuth.value), -180, 180);
    state.view.elevation = clamp(Number(els.elevation.value), -70, 70);
    state.view.zoom = clamp(Number(els.zoom.value), 0.65, 1.6);
    syncViewControls();
    render3dViews();
  }

  function render3dViews() {
    renderSpectrogram();
    renderFitChart();
    renderDerivedSpectrograms();
  }

  function bindCanvasRotation(canvas) {
    let drag = null;
    canvas.addEventListener("pointerdown", (event) => {
      drag = {
        x: event.clientX,
        y: event.clientY,
        azimuth: state.view.azimuth,
        elevation: state.view.elevation,
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-rotating");
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag) return;
      let azimuth = drag.azimuth + (event.clientX - drag.x) * 0.45;
      while (azimuth > 180) azimuth -= 360;
      while (azimuth < -180) azimuth += 360;
      state.view.azimuth = azimuth;
      state.view.elevation = clamp(drag.elevation - (event.clientY - drag.y) * 0.35, -70, 70);
      syncViewControls();
      render3dViews();
    });
    const stopDrag = (event) => {
      if (!drag) return;
      drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.classList.remove("is-rotating");
    };
    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", stopDrag);
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      state.view.zoom = clamp(state.view.zoom - Math.sign(event.deltaY) * 0.05, 0.65, 1.6);
      syncViewControls();
      render3dViews();
    }, { passive: false });
  }

  function bindEvents() {
    els.simulatorButton.addEventListener("click", () => {
      updateSimulationControls();
      if (!els.simulatorDialog.open) els.simulatorDialog.showModal();
    });
    els.simulatorModel.addEventListener("change", renderSimulatorParameters);
    els.simulatorClose.addEventListener("click", () => els.simulatorDialog.close());
    els.simulatorCancel.addEventListener("click", () => els.simulatorDialog.close());
    els.generateSimulation.addEventListener("click", generateSimulatedDataset);
    els.simulatorDialog.addEventListener("click", (event) => {
      if (event.target === els.simulatorDialog) els.simulatorDialog.close();
    });
    $$("input[name='dataSource']").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) activateDataset(input.value);
      });
    });
    els.exampleDataset.addEventListener("change", () => {
      const exampleKey = els.exampleDataset.value;
      const dataset = state.examples[exampleKey];
      if (!dataset) return;
      state.datasets.example = dataset;
      activateDataset("example", EXAMPLE_DEFAULT_FREQUENCIES[exampleKey]);
    });
    els.files.addEventListener("change", async (event) => {
      try {
        await importDataset(event.target.files);
      } catch (error) {
        showToast(error.message || "Nie udało się wczytać danych.", true);
      } finally {
        event.target.value = "";
      }
    });
    els.exportButton.addEventListener("click", exportCsv);
    els.resetButton.addEventListener("click", resetApplication);
    els.run.addEventListener("click", () => runAnalysis());
    els.clearHistory.addEventListener("click", () => {
      state.history = [];
      renderHistory();
    });

    els.frequency.addEventListener("input", debounce(() => {
      updateFrequencyLabels();
      runAnalysis();
    }, 120));
    els.density.addEventListener("input", () => {
      updateFrequencyLabels();
      renderSpectrogram();
      renderDerivedSpectrograms();
    });
    els.component.addEventListener("change", () => {
      renderFitChart();
      renderResidualChart();
    });
    els.threshold.addEventListener("input", updateFrequencyLabels);
    els.showIso.addEventListener("change", renderSpectrogram);
    els.showFit.addEventListener("change", renderSpectrogram);
    els.projection.addEventListener("change", updateViewFromControls);
    [els.azimuth, els.elevation, els.zoom].forEach((control) => {
      control.addEventListener("input", updateViewFromControls);
    });
    els.viewReset.addEventListener("click", () => {
      state.view = {
        projection: DEFAULTS.projection,
        azimuth: DEFAULTS.azimuth,
        elevation: DEFAULTS.elevation,
        zoom: DEFAULTS.zoom,
      };
      syncViewControls();
      render3dViews();
    });
    bindCanvasRotation(els.spectrogramCanvas);
    bindCanvasRotation(els.fitCanvas);
    bindCanvasRotation(els.differentialCanvas);
    bindCanvasRotation(els.relativeCanvas);

    $$("input[name='strategy'], input[name='criterion']").forEach((input) => {
      input.addEventListener("change", () => {
        updateConditionalControls();
        runAnalysis();
      });
    });

    window.addEventListener("resize", debounce(renderAll, 120));
  }

  function initialize() {
    try {
      state.examples = {
        acrylic: normalizeDataset(window.AKRYL_DATA),
        pitting: normalizeDataset(window.PITTING_DATA),
        inhibitor: normalizeDataset(window.INHIBITOR_DATA),
      };
      state.datasets.example = state.examples.acrylic;
      state.dataset = state.datasets.example;
      applyDefaults();
      renderSimulatorParameters();
      bindEvents();
      updateConditionalControls();
      updateDatasetInterface();
      renderHistory();
      runAnalysis({ addHistory: false });
    } catch (error) {
      showToast(error.message || "Nie udało się uruchomić aplikacji.", true);
    }
  }

  initialize();
})();
