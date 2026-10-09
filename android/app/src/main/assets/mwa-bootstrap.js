"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __typeError = (msg) => {
    throw TypeError(msg);
  };
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __commonJS = (cb, mod2) => function __require() {
    try {
      return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
    } catch (e2) {
      throw mod2 = 0, e2;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod2, isNodeMode, target) => (target = mod2 != null ? __create(__getProtoOf(mod2)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod2 || !mod2.__esModule ? __defProp(target, "default", { value: mod2, enumerable: true }) : target,
    mod2
  ));
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
  var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
  var __privateWrapper = (obj, member, setter, getter) => ({
    set _(value) {
      __privateSet(obj, member, value, setter);
    },
    get _() {
      return __privateGet(obj, member, getter);
    }
  });

  // node_modules/qrcode/lib/can-promise.js
  var require_can_promise = __commonJS({
    "node_modules/qrcode/lib/can-promise.js"(exports, module) {
      module.exports = function() {
        return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
      };
    }
  });

  // node_modules/qrcode/lib/core/utils.js
  var require_utils = __commonJS({
    "node_modules/qrcode/lib/core/utils.js"(exports) {
      var toSJISFunction;
      var CODEWORDS_COUNT = [
        0,
        // Not used
        26,
        44,
        70,
        100,
        134,
        172,
        196,
        242,
        292,
        346,
        404,
        466,
        532,
        581,
        655,
        733,
        815,
        901,
        991,
        1085,
        1156,
        1258,
        1364,
        1474,
        1588,
        1706,
        1828,
        1921,
        2051,
        2185,
        2323,
        2465,
        2611,
        2761,
        2876,
        3034,
        3196,
        3362,
        3532,
        3706
      ];
      exports.getSymbolSize = function getSymbolSize(version) {
        if (!version) throw new Error('"version" cannot be null or undefined');
        if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40');
        return version * 4 + 17;
      };
      exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
        return CODEWORDS_COUNT[version];
      };
      exports.getBCHDigit = function(data) {
        let digit = 0;
        while (data !== 0) {
          digit++;
          data >>>= 1;
        }
        return digit;
      };
      exports.setToSJISFunction = function setToSJISFunction(f) {
        if (typeof f !== "function") {
          throw new Error('"toSJISFunc" is not a valid function.');
        }
        toSJISFunction = f;
      };
      exports.isKanjiModeEnabled = function() {
        return typeof toSJISFunction !== "undefined";
      };
      exports.toSJIS = function toSJIS(kanji) {
        return toSJISFunction(kanji);
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-level.js
  var require_error_correction_level = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-level.js"(exports) {
      exports.L = { bit: 1 };
      exports.M = { bit: 0 };
      exports.Q = { bit: 3 };
      exports.H = { bit: 2 };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "l":
          case "low":
            return exports.L;
          case "m":
          case "medium":
            return exports.M;
          case "q":
          case "quartile":
            return exports.Q;
          case "h":
          case "high":
            return exports.H;
          default:
            throw new Error("Unknown EC Level: " + string);
        }
      }
      exports.isValid = function isValid(level) {
        return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
      };
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e2) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/bit-buffer.js
  var require_bit_buffer = __commonJS({
    "node_modules/qrcode/lib/core/bit-buffer.js"(exports, module) {
      function BitBuffer() {
        this.buffer = [];
        this.length = 0;
      }
      BitBuffer.prototype = {
        get: function(index) {
          const bufIndex = Math.floor(index / 8);
          return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
        },
        put: function(num2, length) {
          for (let i = 0; i < length; i++) {
            this.putBit((num2 >>> length - i - 1 & 1) === 1);
          }
        },
        getLengthInBits: function() {
          return this.length;
        },
        putBit: function(bit) {
          const bufIndex = Math.floor(this.length / 8);
          if (this.buffer.length <= bufIndex) {
            this.buffer.push(0);
          }
          if (bit) {
            this.buffer[bufIndex] |= 128 >>> this.length % 8;
          }
          this.length++;
        }
      };
      module.exports = BitBuffer;
    }
  });

  // node_modules/qrcode/lib/core/bit-matrix.js
  var require_bit_matrix = __commonJS({
    "node_modules/qrcode/lib/core/bit-matrix.js"(exports, module) {
      function BitMatrix(size) {
        if (!size || size < 1) {
          throw new Error("BitMatrix size must be defined and greater than 0");
        }
        this.size = size;
        this.data = new Uint8Array(size * size);
        this.reservedBit = new Uint8Array(size * size);
      }
      BitMatrix.prototype.set = function(row, col, value, reserved) {
        const index = row * this.size + col;
        this.data[index] = value;
        if (reserved) this.reservedBit[index] = true;
      };
      BitMatrix.prototype.get = function(row, col) {
        return this.data[row * this.size + col];
      };
      BitMatrix.prototype.xor = function(row, col, value) {
        this.data[row * this.size + col] ^= value;
      };
      BitMatrix.prototype.isReserved = function(row, col) {
        return this.reservedBit[row * this.size + col];
      };
      module.exports = BitMatrix;
    }
  });

  // node_modules/qrcode/lib/core/alignment-pattern.js
  var require_alignment_pattern = __commonJS({
    "node_modules/qrcode/lib/core/alignment-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      exports.getRowColCoords = function getRowColCoords(version) {
        if (version === 1) return [];
        const posCount = Math.floor(version / 7) + 2;
        const size = getSymbolSize(version);
        const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
        const positions = [size - 7];
        for (let i = 1; i < posCount - 1; i++) {
          positions[i] = positions[i - 1] - intervals;
        }
        positions.push(6);
        return positions.reverse();
      };
      exports.getPositions = function getPositions(version) {
        const coords = [];
        const pos = exports.getRowColCoords(version);
        const posLength = pos.length;
        for (let i = 0; i < posLength; i++) {
          for (let j = 0; j < posLength; j++) {
            if (i === 0 && j === 0 || // top-left
            i === 0 && j === posLength - 1 || // bottom-left
            i === posLength - 1 && j === 0) {
              continue;
            }
            coords.push([pos[i], pos[j]]);
          }
        }
        return coords;
      };
    }
  });

  // node_modules/qrcode/lib/core/finder-pattern.js
  var require_finder_pattern = __commonJS({
    "node_modules/qrcode/lib/core/finder-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      var FINDER_PATTERN_SIZE = 7;
      exports.getPositions = function getPositions(version) {
        const size = getSymbolSize(version);
        return [
          // top-left
          [0, 0],
          // top-right
          [size - FINDER_PATTERN_SIZE, 0],
          // bottom-left
          [0, size - FINDER_PATTERN_SIZE]
        ];
      };
    }
  });

  // node_modules/qrcode/lib/core/mask-pattern.js
  var require_mask_pattern = __commonJS({
    "node_modules/qrcode/lib/core/mask-pattern.js"(exports) {
      exports.Patterns = {
        PATTERN000: 0,
        PATTERN001: 1,
        PATTERN010: 2,
        PATTERN011: 3,
        PATTERN100: 4,
        PATTERN101: 5,
        PATTERN110: 6,
        PATTERN111: 7
      };
      var PenaltyScores = {
        N1: 3,
        N2: 3,
        N3: 40,
        N4: 10
      };
      exports.isValid = function isValid(mask) {
        return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
      };
      exports.from = function from(value) {
        return exports.isValid(value) ? parseInt(value, 10) : void 0;
      };
      exports.getPenaltyN1 = function getPenaltyN1(data) {
        const size = data.size;
        let points = 0;
        let sameCountCol = 0;
        let sameCountRow = 0;
        let lastCol = null;
        let lastRow = null;
        for (let row = 0; row < size; row++) {
          sameCountCol = sameCountRow = 0;
          lastCol = lastRow = null;
          for (let col = 0; col < size; col++) {
            let module2 = data.get(row, col);
            if (module2 === lastCol) {
              sameCountCol++;
            } else {
              if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
              lastCol = module2;
              sameCountCol = 1;
            }
            module2 = data.get(col, row);
            if (module2 === lastRow) {
              sameCountRow++;
            } else {
              if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
              lastRow = module2;
              sameCountRow = 1;
            }
          }
          if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
          if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
        }
        return points;
      };
      exports.getPenaltyN2 = function getPenaltyN2(data) {
        const size = data.size;
        let points = 0;
        for (let row = 0; row < size - 1; row++) {
          for (let col = 0; col < size - 1; col++) {
            const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
            if (last === 4 || last === 0) points++;
          }
        }
        return points * PenaltyScores.N2;
      };
      exports.getPenaltyN3 = function getPenaltyN3(data) {
        const size = data.size;
        let points = 0;
        let bitsCol = 0;
        let bitsRow = 0;
        for (let row = 0; row < size; row++) {
          bitsCol = bitsRow = 0;
          for (let col = 0; col < size; col++) {
            bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
            if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
            bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
            if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
          }
        }
        return points * PenaltyScores.N3;
      };
      exports.getPenaltyN4 = function getPenaltyN4(data) {
        let darkCount = 0;
        const modulesCount = data.data.length;
        for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
        const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
        return k * PenaltyScores.N4;
      };
      function getMaskAt(maskPattern, i, j) {
        switch (maskPattern) {
          case exports.Patterns.PATTERN000:
            return (i + j) % 2 === 0;
          case exports.Patterns.PATTERN001:
            return i % 2 === 0;
          case exports.Patterns.PATTERN010:
            return j % 3 === 0;
          case exports.Patterns.PATTERN011:
            return (i + j) % 3 === 0;
          case exports.Patterns.PATTERN100:
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
          case exports.Patterns.PATTERN101:
            return i * j % 2 + i * j % 3 === 0;
          case exports.Patterns.PATTERN110:
            return (i * j % 2 + i * j % 3) % 2 === 0;
          case exports.Patterns.PATTERN111:
            return (i * j % 3 + (i + j) % 2) % 2 === 0;
          default:
            throw new Error("bad maskPattern:" + maskPattern);
        }
      }
      exports.applyMask = function applyMask(pattern, data) {
        const size = data.size;
        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size; row++) {
            if (data.isReserved(row, col)) continue;
            data.xor(row, col, getMaskAt(pattern, row, col));
          }
        }
      };
      exports.getBestMask = function getBestMask(data, setupFormatFunc) {
        const numPatterns = Object.keys(exports.Patterns).length;
        let bestPattern = 0;
        let lowerPenalty = Infinity;
        for (let p = 0; p < numPatterns; p++) {
          setupFormatFunc(p);
          exports.applyMask(p, data);
          const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
          exports.applyMask(p, data);
          if (penalty < lowerPenalty) {
            lowerPenalty = penalty;
            bestPattern = p;
          }
        }
        return bestPattern;
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-code.js
  var require_error_correction_code = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-code.js"(exports) {
      var ECLevel = require_error_correction_level();
      var EC_BLOCKS_TABLE = [
        // L  M  Q  H
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        2,
        1,
        2,
        2,
        4,
        1,
        2,
        4,
        4,
        2,
        4,
        4,
        4,
        2,
        4,
        6,
        5,
        2,
        4,
        6,
        6,
        2,
        5,
        8,
        8,
        4,
        5,
        8,
        8,
        4,
        5,
        8,
        11,
        4,
        8,
        10,
        11,
        4,
        9,
        12,
        16,
        4,
        9,
        16,
        16,
        6,
        10,
        12,
        18,
        6,
        10,
        17,
        16,
        6,
        11,
        16,
        19,
        6,
        13,
        18,
        21,
        7,
        14,
        21,
        25,
        8,
        16,
        20,
        25,
        8,
        17,
        23,
        25,
        9,
        17,
        23,
        34,
        9,
        18,
        25,
        30,
        10,
        20,
        27,
        32,
        12,
        21,
        29,
        35,
        12,
        23,
        34,
        37,
        12,
        25,
        34,
        40,
        13,
        26,
        35,
        42,
        14,
        28,
        38,
        45,
        15,
        29,
        40,
        48,
        16,
        31,
        43,
        51,
        17,
        33,
        45,
        54,
        18,
        35,
        48,
        57,
        19,
        37,
        51,
        60,
        19,
        38,
        53,
        63,
        20,
        40,
        56,
        66,
        21,
        43,
        59,
        70,
        22,
        45,
        62,
        74,
        24,
        47,
        65,
        77,
        25,
        49,
        68,
        81
      ];
      var EC_CODEWORDS_TABLE = [
        // L  M  Q  H
        7,
        10,
        13,
        17,
        10,
        16,
        22,
        28,
        15,
        26,
        36,
        44,
        20,
        36,
        52,
        64,
        26,
        48,
        72,
        88,
        36,
        64,
        96,
        112,
        40,
        72,
        108,
        130,
        48,
        88,
        132,
        156,
        60,
        110,
        160,
        192,
        72,
        130,
        192,
        224,
        80,
        150,
        224,
        264,
        96,
        176,
        260,
        308,
        104,
        198,
        288,
        352,
        120,
        216,
        320,
        384,
        132,
        240,
        360,
        432,
        144,
        280,
        408,
        480,
        168,
        308,
        448,
        532,
        180,
        338,
        504,
        588,
        196,
        364,
        546,
        650,
        224,
        416,
        600,
        700,
        224,
        442,
        644,
        750,
        252,
        476,
        690,
        816,
        270,
        504,
        750,
        900,
        300,
        560,
        810,
        960,
        312,
        588,
        870,
        1050,
        336,
        644,
        952,
        1110,
        360,
        700,
        1020,
        1200,
        390,
        728,
        1050,
        1260,
        420,
        784,
        1140,
        1350,
        450,
        812,
        1200,
        1440,
        480,
        868,
        1290,
        1530,
        510,
        924,
        1350,
        1620,
        540,
        980,
        1440,
        1710,
        570,
        1036,
        1530,
        1800,
        570,
        1064,
        1590,
        1890,
        600,
        1120,
        1680,
        1980,
        630,
        1204,
        1770,
        2100,
        660,
        1260,
        1860,
        2220,
        720,
        1316,
        1950,
        2310,
        750,
        1372,
        2040,
        2430
      ];
      exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
      exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/galois-field.js
  var require_galois_field = __commonJS({
    "node_modules/qrcode/lib/core/galois-field.js"(exports) {
      var EXP_TABLE = new Uint8Array(512);
      var LOG_TABLE = new Uint8Array(256);
      (function initTables() {
        let x = 1;
        for (let i = 0; i < 255; i++) {
          EXP_TABLE[i] = x;
          LOG_TABLE[x] = i;
          x <<= 1;
          if (x & 256) {
            x ^= 285;
          }
        }
        for (let i = 255; i < 512; i++) {
          EXP_TABLE[i] = EXP_TABLE[i - 255];
        }
      })();
      exports.log = function log(n) {
        if (n < 1) throw new Error("log(" + n + ")");
        return LOG_TABLE[n];
      };
      exports.exp = function exp(n) {
        return EXP_TABLE[n];
      };
      exports.mul = function mul(x, y) {
        if (x === 0 || y === 0) return 0;
        return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
      };
    }
  });

  // node_modules/qrcode/lib/core/polynomial.js
  var require_polynomial = __commonJS({
    "node_modules/qrcode/lib/core/polynomial.js"(exports) {
      var GF = require_galois_field();
      exports.mul = function mul(p1, p2) {
        const coeff = new Uint8Array(p1.length + p2.length - 1);
        for (let i = 0; i < p1.length; i++) {
          for (let j = 0; j < p2.length; j++) {
            coeff[i + j] ^= GF.mul(p1[i], p2[j]);
          }
        }
        return coeff;
      };
      exports.mod = function mod2(divident, divisor) {
        let result = new Uint8Array(divident);
        while (result.length - divisor.length >= 0) {
          const coeff = result[0];
          for (let i = 0; i < divisor.length; i++) {
            result[i] ^= GF.mul(divisor[i], coeff);
          }
          let offset = 0;
          while (offset < result.length && result[offset] === 0) offset++;
          result = result.slice(offset);
        }
        return result;
      };
      exports.generateECPolynomial = function generateECPolynomial(degree) {
        let poly = new Uint8Array([1]);
        for (let i = 0; i < degree; i++) {
          poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
        }
        return poly;
      };
    }
  });

  // node_modules/qrcode/lib/core/reed-solomon-encoder.js
  var require_reed_solomon_encoder = __commonJS({
    "node_modules/qrcode/lib/core/reed-solomon-encoder.js"(exports, module) {
      var Polynomial = require_polynomial();
      function ReedSolomonEncoder(degree) {
        this.genPoly = void 0;
        this.degree = degree;
        if (this.degree) this.initialize(this.degree);
      }
      ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
        this.degree = degree;
        this.genPoly = Polynomial.generateECPolynomial(this.degree);
      };
      ReedSolomonEncoder.prototype.encode = function encode2(data) {
        if (!this.genPoly) {
          throw new Error("Encoder not initialized");
        }
        const paddedData = new Uint8Array(data.length + this.degree);
        paddedData.set(data);
        const remainder = Polynomial.mod(paddedData, this.genPoly);
        const start = this.degree - remainder.length;
        if (start > 0) {
          const buff = new Uint8Array(this.degree);
          buff.set(remainder, start);
          return buff;
        }
        return remainder;
      };
      module.exports = ReedSolomonEncoder;
    }
  });

  // node_modules/qrcode/lib/core/version-check.js
  var require_version_check = __commonJS({
    "node_modules/qrcode/lib/core/version-check.js"(exports) {
      exports.isValid = function isValid(version) {
        return !isNaN(version) && version >= 1 && version <= 40;
      };
    }
  });

  // node_modules/qrcode/lib/core/regex.js
  var require_regex = __commonJS({
    "node_modules/qrcode/lib/core/regex.js"(exports) {
      var numeric = "[0-9]+";
      var alphanumeric = "[A-Z $%*+\\-./:]+";
      var kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
      kanji = kanji.replace(/u/g, "\\u");
      var byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
      exports.KANJI = new RegExp(kanji, "g");
      exports.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
      exports.BYTE = new RegExp(byte, "g");
      exports.NUMERIC = new RegExp(numeric, "g");
      exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
      var TEST_KANJI = new RegExp("^" + kanji + "$");
      var TEST_NUMERIC = new RegExp("^" + numeric + "$");
      var TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
      exports.testKanji = function testKanji(str) {
        return TEST_KANJI.test(str);
      };
      exports.testNumeric = function testNumeric(str) {
        return TEST_NUMERIC.test(str);
      };
      exports.testAlphanumeric = function testAlphanumeric(str) {
        return TEST_ALPHANUMERIC.test(str);
      };
    }
  });

  // node_modules/qrcode/lib/core/mode.js
  var require_mode = __commonJS({
    "node_modules/qrcode/lib/core/mode.js"(exports) {
      var VersionCheck = require_version_check();
      var Regex = require_regex();
      exports.NUMERIC = {
        id: "Numeric",
        bit: 1 << 0,
        ccBits: [10, 12, 14]
      };
      exports.ALPHANUMERIC = {
        id: "Alphanumeric",
        bit: 1 << 1,
        ccBits: [9, 11, 13]
      };
      exports.BYTE = {
        id: "Byte",
        bit: 1 << 2,
        ccBits: [8, 16, 16]
      };
      exports.KANJI = {
        id: "Kanji",
        bit: 1 << 3,
        ccBits: [8, 10, 12]
      };
      exports.MIXED = {
        bit: -1
      };
      exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
        if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid version: " + version);
        }
        if (version >= 1 && version < 10) return mode.ccBits[0];
        else if (version < 27) return mode.ccBits[1];
        return mode.ccBits[2];
      };
      exports.getBestModeForData = function getBestModeForData(dataStr) {
        if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
        else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
        else if (Regex.testKanji(dataStr)) return exports.KANJI;
        else return exports.BYTE;
      };
      exports.toString = function toString(mode) {
        if (mode && mode.id) return mode.id;
        throw new Error("Invalid mode");
      };
      exports.isValid = function isValid(mode) {
        return mode && mode.bit && mode.ccBits;
      };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "numeric":
            return exports.NUMERIC;
          case "alphanumeric":
            return exports.ALPHANUMERIC;
          case "kanji":
            return exports.KANJI;
          case "byte":
            return exports.BYTE;
          default:
            throw new Error("Unknown mode: " + string);
        }
      }
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e2) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/version.js
  var require_version = __commonJS({
    "node_modules/qrcode/lib/core/version.js"(exports) {
      var Utils = require_utils();
      var ECCode = require_error_correction_code();
      var ECLevel = require_error_correction_level();
      var Mode = require_mode();
      var VersionCheck = require_version_check();
      var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
      var G18_BCH = Utils.getBCHDigit(G18);
      function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      function getReservedBitsCount(mode, version) {
        return Mode.getCharCountIndicator(mode, version) + 4;
      }
      function getTotalBitsFromDataArray(segments, version) {
        let totalBits = 0;
        segments.forEach(function(data) {
          const reservedBits = getReservedBitsCount(data.mode, version);
          totalBits += reservedBits + data.getBitsLength();
        });
        return totalBits;
      }
      function getBestVersionForMixedData(segments, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          const length = getTotalBitsFromDataArray(segments, currentVersion);
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      exports.from = function from(value, defaultValue) {
        if (VersionCheck.isValid(value)) {
          return parseInt(value, 10);
        }
        return defaultValue;
      };
      exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid QR Code version");
        }
        if (typeof mode === "undefined") mode = Mode.BYTE;
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (mode === Mode.MIXED) return dataTotalCodewordsBits;
        const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
        switch (mode) {
          case Mode.NUMERIC:
            return Math.floor(usableBits / 10 * 3);
          case Mode.ALPHANUMERIC:
            return Math.floor(usableBits / 11 * 2);
          case Mode.KANJI:
            return Math.floor(usableBits / 13);
          case Mode.BYTE:
          default:
            return Math.floor(usableBits / 8);
        }
      };
      exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
        let seg;
        const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
        if (Array.isArray(data)) {
          if (data.length > 1) {
            return getBestVersionForMixedData(data, ecl);
          }
          if (data.length === 0) {
            return 1;
          }
          seg = data[0];
        } else {
          seg = data;
        }
        return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
      };
      exports.getEncodedBits = function getEncodedBits(version) {
        if (!VersionCheck.isValid(version) || version < 7) {
          throw new Error("Invalid QR Code version");
        }
        let d = version << 12;
        while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
          d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
        }
        return version << 12 | d;
      };
    }
  });

  // node_modules/qrcode/lib/core/format-info.js
  var require_format_info = __commonJS({
    "node_modules/qrcode/lib/core/format-info.js"(exports) {
      var Utils = require_utils();
      var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
      var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
      var G15_BCH = Utils.getBCHDigit(G15);
      exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
        const data = errorCorrectionLevel.bit << 3 | mask;
        let d = data << 10;
        while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
          d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
        }
        return (data << 10 | d) ^ G15_MASK;
      };
    }
  });

  // node_modules/qrcode/lib/core/numeric-data.js
  var require_numeric_data = __commonJS({
    "node_modules/qrcode/lib/core/numeric-data.js"(exports, module) {
      var Mode = require_mode();
      function NumericData(data) {
        this.mode = Mode.NUMERIC;
        this.data = data.toString();
      }
      NumericData.getBitsLength = function getBitsLength(length) {
        return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
      };
      NumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      NumericData.prototype.getBitsLength = function getBitsLength() {
        return NumericData.getBitsLength(this.data.length);
      };
      NumericData.prototype.write = function write(bitBuffer) {
        let i, group, value;
        for (i = 0; i + 3 <= this.data.length; i += 3) {
          group = this.data.substr(i, 3);
          value = parseInt(group, 10);
          bitBuffer.put(value, 10);
        }
        const remainingNum = this.data.length - i;
        if (remainingNum > 0) {
          group = this.data.substr(i);
          value = parseInt(group, 10);
          bitBuffer.put(value, remainingNum * 3 + 1);
        }
      };
      module.exports = NumericData;
    }
  });

  // node_modules/qrcode/lib/core/alphanumeric-data.js
  var require_alphanumeric_data = __commonJS({
    "node_modules/qrcode/lib/core/alphanumeric-data.js"(exports, module) {
      var Mode = require_mode();
      var ALPHA_NUM_CHARS = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        " ",
        "$",
        "%",
        "*",
        "+",
        "-",
        ".",
        "/",
        ":"
      ];
      function AlphanumericData(data) {
        this.mode = Mode.ALPHANUMERIC;
        this.data = data;
      }
      AlphanumericData.getBitsLength = function getBitsLength(length) {
        return 11 * Math.floor(length / 2) + 6 * (length % 2);
      };
      AlphanumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      AlphanumericData.prototype.getBitsLength = function getBitsLength() {
        return AlphanumericData.getBitsLength(this.data.length);
      };
      AlphanumericData.prototype.write = function write(bitBuffer) {
        let i;
        for (i = 0; i + 2 <= this.data.length; i += 2) {
          let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
          value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
          bitBuffer.put(value, 11);
        }
        if (this.data.length % 2) {
          bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
        }
      };
      module.exports = AlphanumericData;
    }
  });

  // node_modules/qrcode/lib/core/byte-data.js
  var require_byte_data = __commonJS({
    "node_modules/qrcode/lib/core/byte-data.js"(exports, module) {
      var Mode = require_mode();
      function ByteData(data) {
        this.mode = Mode.BYTE;
        if (typeof data === "string") {
          this.data = new TextEncoder().encode(data);
        } else {
          this.data = new Uint8Array(data);
        }
      }
      ByteData.getBitsLength = function getBitsLength(length) {
        return length * 8;
      };
      ByteData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      ByteData.prototype.getBitsLength = function getBitsLength() {
        return ByteData.getBitsLength(this.data.length);
      };
      ByteData.prototype.write = function(bitBuffer) {
        for (let i = 0, l = this.data.length; i < l; i++) {
          bitBuffer.put(this.data[i], 8);
        }
      };
      module.exports = ByteData;
    }
  });

  // node_modules/qrcode/lib/core/kanji-data.js
  var require_kanji_data = __commonJS({
    "node_modules/qrcode/lib/core/kanji-data.js"(exports, module) {
      var Mode = require_mode();
      var Utils = require_utils();
      function KanjiData(data) {
        this.mode = Mode.KANJI;
        this.data = data;
      }
      KanjiData.getBitsLength = function getBitsLength(length) {
        return length * 13;
      };
      KanjiData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      KanjiData.prototype.getBitsLength = function getBitsLength() {
        return KanjiData.getBitsLength(this.data.length);
      };
      KanjiData.prototype.write = function(bitBuffer) {
        let i;
        for (i = 0; i < this.data.length; i++) {
          let value = Utils.toSJIS(this.data[i]);
          if (value >= 33088 && value <= 40956) {
            value -= 33088;
          } else if (value >= 57408 && value <= 60351) {
            value -= 49472;
          } else {
            throw new Error(
              "Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8"
            );
          }
          value = (value >>> 8 & 255) * 192 + (value & 255);
          bitBuffer.put(value, 13);
        }
      };
      module.exports = KanjiData;
    }
  });

  // node_modules/dijkstrajs/dijkstra.js
  var require_dijkstra = __commonJS({
    "node_modules/dijkstrajs/dijkstra.js"(exports, module) {
      "use strict";
      var dijkstra = {
        single_source_shortest_paths: function(graph, s, d) {
          var predecessors = {};
          var costs = {};
          costs[s] = 0;
          var open = dijkstra.PriorityQueue.make();
          open.push(s, 0);
          var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
          while (!open.empty()) {
            closest = open.pop();
            u = closest.value;
            cost_of_s_to_u = closest.cost;
            adjacent_nodes = graph[u] || {};
            for (v in adjacent_nodes) {
              if (adjacent_nodes.hasOwnProperty(v)) {
                cost_of_e = adjacent_nodes[v];
                cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
                cost_of_s_to_v = costs[v];
                first_visit = typeof costs[v] === "undefined";
                if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
                  costs[v] = cost_of_s_to_u_plus_cost_of_e;
                  open.push(v, cost_of_s_to_u_plus_cost_of_e);
                  predecessors[v] = u;
                }
              }
            }
          }
          if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
            var msg = ["Could not find a path from ", s, " to ", d, "."].join("");
            throw new Error(msg);
          }
          return predecessors;
        },
        extract_shortest_path_from_predecessor_list: function(predecessors, d) {
          var nodes = [];
          var u = d;
          var predecessor;
          while (u) {
            nodes.push(u);
            predecessor = predecessors[u];
            u = predecessors[u];
          }
          nodes.reverse();
          return nodes;
        },
        find_path: function(graph, s, d) {
          var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
          return dijkstra.extract_shortest_path_from_predecessor_list(
            predecessors,
            d
          );
        },
        /**
         * A very naive priority queue implementation.
         */
        PriorityQueue: {
          make: function(opts) {
            var T = dijkstra.PriorityQueue, t = {}, key;
            opts = opts || {};
            for (key in T) {
              if (T.hasOwnProperty(key)) {
                t[key] = T[key];
              }
            }
            t.queue = [];
            t.sorter = opts.sorter || T.default_sorter;
            return t;
          },
          default_sorter: function(a, b) {
            return a.cost - b.cost;
          },
          /**
           * Add a new item to the queue and ensure the highest priority element
           * is at the front of the queue.
           */
          push: function(value, cost) {
            var item = { value, cost };
            this.queue.push(item);
            this.queue.sort(this.sorter);
          },
          /**
           * Return the highest priority element in the queue.
           */
          pop: function() {
            return this.queue.shift();
          },
          empty: function() {
            return this.queue.length === 0;
          }
        }
      };
      if (typeof module !== "undefined") {
        module.exports = dijkstra;
      }
    }
  });

  // node_modules/qrcode/lib/core/segments.js
  var require_segments = __commonJS({
    "node_modules/qrcode/lib/core/segments.js"(exports) {
      var Mode = require_mode();
      var NumericData = require_numeric_data();
      var AlphanumericData = require_alphanumeric_data();
      var ByteData = require_byte_data();
      var KanjiData = require_kanji_data();
      var Regex = require_regex();
      var Utils = require_utils();
      var dijkstra = require_dijkstra();
      function getStringByteLength(str) {
        return unescape(encodeURIComponent(str)).length;
      }
      function getSegments(regex, mode, str) {
        const segments = [];
        let result;
        while ((result = regex.exec(str)) !== null) {
          segments.push({
            data: result[0],
            index: result.index,
            mode,
            length: result[0].length
          });
        }
        return segments;
      }
      function getSegmentsFromString(dataStr) {
        const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
        const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
        let byteSegs;
        let kanjiSegs;
        if (Utils.isKanjiModeEnabled()) {
          byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
          kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
        } else {
          byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
          kanjiSegs = [];
        }
        const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
        return segs.sort(function(s1, s2) {
          return s1.index - s2.index;
        }).map(function(obj) {
          return {
            data: obj.data,
            mode: obj.mode,
            length: obj.length
          };
        });
      }
      function getSegmentBitsLength(length, mode) {
        switch (mode) {
          case Mode.NUMERIC:
            return NumericData.getBitsLength(length);
          case Mode.ALPHANUMERIC:
            return AlphanumericData.getBitsLength(length);
          case Mode.KANJI:
            return KanjiData.getBitsLength(length);
          case Mode.BYTE:
            return ByteData.getBitsLength(length);
        }
      }
      function mergeSegments(segs) {
        return segs.reduce(function(acc, curr) {
          const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
          if (prevSeg && prevSeg.mode === curr.mode) {
            acc[acc.length - 1].data += curr.data;
            return acc;
          }
          acc.push(curr);
          return acc;
        }, []);
      }
      function buildNodes(segs) {
        const nodes = [];
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          switch (seg.mode) {
            case Mode.NUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.ALPHANUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.KANJI:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
              break;
            case Mode.BYTE:
              nodes.push([
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
          }
        }
        return nodes;
      }
      function buildGraph(nodes, version) {
        const table = {};
        const graph = { start: {} };
        let prevNodeIds = ["start"];
        for (let i = 0; i < nodes.length; i++) {
          const nodeGroup = nodes[i];
          const currentNodeIds = [];
          for (let j = 0; j < nodeGroup.length; j++) {
            const node = nodeGroup[j];
            const key = "" + i + j;
            currentNodeIds.push(key);
            table[key] = { node, lastCount: 0 };
            graph[key] = {};
            for (let n = 0; n < prevNodeIds.length; n++) {
              const prevNodeId = prevNodeIds[n];
              if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
                graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
                table[prevNodeId].lastCount += node.length;
              } else {
                if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
                graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
              }
            }
          }
          prevNodeIds = currentNodeIds;
        }
        for (let n = 0; n < prevNodeIds.length; n++) {
          graph[prevNodeIds[n]].end = 0;
        }
        return { map: graph, table };
      }
      function buildSingleSegment(data, modesHint) {
        let mode;
        const bestMode = Mode.getBestModeForData(data);
        mode = Mode.from(modesHint, bestMode);
        if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
          throw new Error('"' + data + '" cannot be encoded with mode ' + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
        }
        if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
          mode = Mode.BYTE;
        }
        switch (mode) {
          case Mode.NUMERIC:
            return new NumericData(data);
          case Mode.ALPHANUMERIC:
            return new AlphanumericData(data);
          case Mode.KANJI:
            return new KanjiData(data);
          case Mode.BYTE:
            return new ByteData(data);
        }
      }
      exports.fromArray = function fromArray(array) {
        return array.reduce(function(acc, seg) {
          if (typeof seg === "string") {
            acc.push(buildSingleSegment(seg, null));
          } else if (seg.data) {
            acc.push(buildSingleSegment(seg.data, seg.mode));
          }
          return acc;
        }, []);
      };
      exports.fromString = function fromString(data, version) {
        const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());
        const nodes = buildNodes(segs);
        const graph = buildGraph(nodes, version);
        const path = dijkstra.find_path(graph.map, "start", "end");
        const optimizedSegs = [];
        for (let i = 1; i < path.length - 1; i++) {
          optimizedSegs.push(graph.table[path[i]].node);
        }
        return exports.fromArray(mergeSegments(optimizedSegs));
      };
      exports.rawSplit = function rawSplit(data) {
        return exports.fromArray(
          getSegmentsFromString(data, Utils.isKanjiModeEnabled())
        );
      };
    }
  });

  // node_modules/qrcode/lib/core/qrcode.js
  var require_qrcode = __commonJS({
    "node_modules/qrcode/lib/core/qrcode.js"(exports) {
      var Utils = require_utils();
      var ECLevel = require_error_correction_level();
      var BitBuffer = require_bit_buffer();
      var BitMatrix = require_bit_matrix();
      var AlignmentPattern = require_alignment_pattern();
      var FinderPattern = require_finder_pattern();
      var MaskPattern = require_mask_pattern();
      var ECCode = require_error_correction_code();
      var ReedSolomonEncoder = require_reed_solomon_encoder();
      var Version = require_version();
      var FormatInfo = require_format_info();
      var Mode = require_mode();
      var Segments = require_segments();
      function setupFinderPattern(matrix, version) {
        const size = matrix.size;
        const pos = FinderPattern.getPositions(version);
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || size <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
              if (col + c <= -1 || size <= col + c) continue;
              if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupTimingPattern(matrix) {
        const size = matrix.size;
        for (let r = 8; r < size - 8; r++) {
          const value = r % 2 === 0;
          matrix.set(r, 6, value, true);
          matrix.set(6, r, value, true);
        }
      }
      function setupAlignmentPattern(matrix, version) {
        const pos = AlignmentPattern.getPositions(version);
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupVersionInfo(matrix, version) {
        const size = matrix.size;
        const bits = Version.getEncodedBits(version);
        let row, col, mod2;
        for (let i = 0; i < 18; i++) {
          row = Math.floor(i / 3);
          col = i % 3 + size - 8 - 3;
          mod2 = (bits >> i & 1) === 1;
          matrix.set(row, col, mod2, true);
          matrix.set(col, row, mod2, true);
        }
      }
      function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
        const size = matrix.size;
        const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
        let i, mod2;
        for (i = 0; i < 15; i++) {
          mod2 = (bits >> i & 1) === 1;
          if (i < 6) {
            matrix.set(i, 8, mod2, true);
          } else if (i < 8) {
            matrix.set(i + 1, 8, mod2, true);
          } else {
            matrix.set(size - 15 + i, 8, mod2, true);
          }
          if (i < 8) {
            matrix.set(8, size - i - 1, mod2, true);
          } else if (i < 9) {
            matrix.set(8, 15 - i - 1 + 1, mod2, true);
          } else {
            matrix.set(8, 15 - i - 1, mod2, true);
          }
        }
        matrix.set(size - 8, 8, 1, true);
      }
      function setupData(matrix, data) {
        const size = matrix.size;
        let inc = -1;
        let row = size - 1;
        let bitIndex = 7;
        let byteIndex = 0;
        for (let col = size - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          while (true) {
            for (let c = 0; c < 2; c++) {
              if (!matrix.isReserved(row, col - c)) {
                let dark = false;
                if (byteIndex < data.length) {
                  dark = (data[byteIndex] >>> bitIndex & 1) === 1;
                }
                matrix.set(row, col - c, dark);
                bitIndex--;
                if (bitIndex === -1) {
                  byteIndex++;
                  bitIndex = 7;
                }
              }
            }
            row += inc;
            if (row < 0 || size <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      }
      function createData(version, errorCorrectionLevel, segments) {
        const buffer = new BitBuffer();
        segments.forEach(function(data) {
          buffer.put(data.mode.bit, 4);
          buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
          data.write(buffer);
        });
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
          buffer.put(0, 4);
        }
        while (buffer.getLengthInBits() % 8 !== 0) {
          buffer.putBit(0);
        }
        const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
        for (let i = 0; i < remainingByte; i++) {
          buffer.put(i % 2 ? 17 : 236, 8);
        }
        return createCodewords(buffer, version, errorCorrectionLevel);
      }
      function createCodewords(bitBuffer, version, errorCorrectionLevel) {
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewords = totalCodewords - ecTotalCodewords;
        const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
        const blocksInGroup2 = totalCodewords % ecTotalBlocks;
        const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
        const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
        const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
        const rs = new ReedSolomonEncoder(ecCount);
        let offset = 0;
        const dcData = new Array(ecTotalBlocks);
        const ecData = new Array(ecTotalBlocks);
        let maxDataSize = 0;
        const buffer = new Uint8Array(bitBuffer.buffer);
        for (let b = 0; b < ecTotalBlocks; b++) {
          const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
          dcData[b] = buffer.slice(offset, offset + dataSize);
          ecData[b] = rs.encode(dcData[b]);
          offset += dataSize;
          maxDataSize = Math.max(maxDataSize, dataSize);
        }
        const data = new Uint8Array(totalCodewords);
        let index = 0;
        let i, r;
        for (i = 0; i < maxDataSize; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            if (i < dcData[r].length) {
              data[index++] = dcData[r][i];
            }
          }
        }
        for (i = 0; i < ecCount; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            data[index++] = ecData[r][i];
          }
        }
        return data;
      }
      function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
        let segments;
        if (Array.isArray(data)) {
          segments = Segments.fromArray(data);
        } else if (typeof data === "string") {
          let estimatedVersion = version;
          if (!estimatedVersion) {
            const rawSegments = Segments.rawSplit(data);
            estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
          }
          segments = Segments.fromString(data, estimatedVersion || 40);
        } else {
          throw new Error("Invalid data");
        }
        const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
        if (!bestVersion) {
          throw new Error("The amount of data is too big to be stored in a QR Code");
        }
        if (!version) {
          version = bestVersion;
        } else if (version < bestVersion) {
          throw new Error(
            "\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n"
          );
        }
        const dataBits = createData(version, errorCorrectionLevel, segments);
        const moduleCount = Utils.getSymbolSize(version);
        const modules = new BitMatrix(moduleCount);
        setupFinderPattern(modules, version);
        setupTimingPattern(modules);
        setupAlignmentPattern(modules, version);
        setupFormatInfo(modules, errorCorrectionLevel, 0);
        if (version >= 7) {
          setupVersionInfo(modules, version);
        }
        setupData(modules, dataBits);
        if (isNaN(maskPattern)) {
          maskPattern = MaskPattern.getBestMask(
            modules,
            setupFormatInfo.bind(null, modules, errorCorrectionLevel)
          );
        }
        MaskPattern.applyMask(maskPattern, modules);
        setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
        return {
          modules,
          version,
          errorCorrectionLevel,
          maskPattern,
          segments
        };
      }
      exports.create = function create(data, options) {
        if (typeof data === "undefined" || data === "") {
          throw new Error("No input text");
        }
        let errorCorrectionLevel = ECLevel.M;
        let version;
        let mask;
        if (typeof options !== "undefined") {
          errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
          version = Version.from(options.version);
          mask = MaskPattern.from(options.maskPattern);
          if (options.toSJISFunc) {
            Utils.setToSJISFunction(options.toSJISFunc);
          }
        }
        return createSymbol(data, version, errorCorrectionLevel, mask);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/utils.js
  var require_utils2 = __commonJS({
    "node_modules/qrcode/lib/renderer/utils.js"(exports) {
      function hex2rgba(hex) {
        if (typeof hex === "number") {
          hex = hex.toString();
        }
        if (typeof hex !== "string") {
          throw new Error("Color should be defined as hex string");
        }
        let hexCode = hex.slice().replace("#", "").split("");
        if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
          throw new Error("Invalid hex color: " + hex);
        }
        if (hexCode.length === 3 || hexCode.length === 4) {
          hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
            return [c, c];
          }));
        }
        if (hexCode.length === 6) hexCode.push("F", "F");
        const hexValue = parseInt(hexCode.join(""), 16);
        return {
          r: hexValue >> 24 & 255,
          g: hexValue >> 16 & 255,
          b: hexValue >> 8 & 255,
          a: hexValue & 255,
          hex: "#" + hexCode.slice(0, 6).join("")
        };
      }
      exports.getOptions = function getOptions(options) {
        if (!options) options = {};
        if (!options.color) options.color = {};
        const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
        const width = options.width && options.width >= 21 ? options.width : void 0;
        const scale = options.scale || 4;
        return {
          width,
          scale: width ? 4 : scale,
          margin,
          color: {
            dark: hex2rgba(options.color.dark || "#000000ff"),
            light: hex2rgba(options.color.light || "#ffffffff")
          },
          type: options.type,
          rendererOpts: options.rendererOpts || {}
        };
      };
      exports.getScale = function getScale(qrSize, opts) {
        return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
      };
      exports.getImageWidth = function getImageWidth(qrSize, opts) {
        const scale = exports.getScale(qrSize, opts);
        return Math.floor((qrSize + opts.margin * 2) * scale);
      };
      exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
        const size = qr.modules.size;
        const data = qr.modules.data;
        const scale = exports.getScale(size, opts);
        const symbolSize = Math.floor((size + opts.margin * 2) * scale);
        const scaledMargin = opts.margin * scale;
        const palette = [opts.color.light, opts.color.dark];
        for (let i = 0; i < symbolSize; i++) {
          for (let j = 0; j < symbolSize; j++) {
            let posDst = (i * symbolSize + j) * 4;
            let pxColor = opts.color.light;
            if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
              const iSrc = Math.floor((i - scaledMargin) / scale);
              const jSrc = Math.floor((j - scaledMargin) / scale);
              pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
            }
            imgData[posDst++] = pxColor.r;
            imgData[posDst++] = pxColor.g;
            imgData[posDst++] = pxColor.b;
            imgData[posDst] = pxColor.a;
          }
        }
      };
    }
  });

  // node_modules/qrcode/lib/renderer/canvas.js
  var require_canvas = __commonJS({
    "node_modules/qrcode/lib/renderer/canvas.js"(exports) {
      var Utils = require_utils2();
      function clearCanvas(ctx, canvas, size) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!canvas.style) canvas.style = {};
        canvas.height = size;
        canvas.width = size;
        canvas.style.height = size + "px";
        canvas.style.width = size + "px";
      }
      function getCanvasElement() {
        try {
          return document.createElement("canvas");
        } catch (e2) {
          throw new Error("You need to specify a canvas element");
        }
      }
      exports.render = function render(qrData, canvas, options) {
        let opts = options;
        let canvasEl = canvas;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!canvas) {
          canvasEl = getCanvasElement();
        }
        opts = Utils.getOptions(opts);
        const size = Utils.getImageWidth(qrData.modules.size, opts);
        const ctx = canvasEl.getContext("2d");
        const image = ctx.createImageData(size, size);
        Utils.qrToImageData(image.data, qrData, opts);
        clearCanvas(ctx, canvasEl, size);
        ctx.putImageData(image, 0, 0);
        return canvasEl;
      };
      exports.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
        let opts = options;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!opts) opts = {};
        const canvasEl = exports.render(qrData, canvas, opts);
        const type = opts.type || "image/png";
        const rendererOpts = opts.rendererOpts || {};
        return canvasEl.toDataURL(type, rendererOpts.quality);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/svg-tag.js
  var require_svg_tag = __commonJS({
    "node_modules/qrcode/lib/renderer/svg-tag.js"(exports) {
      var Utils = require_utils2();
      function getColorAttrib(color, attrib) {
        const alpha = color.a / 255;
        const str = attrib + '="' + color.hex + '"';
        return alpha < 1 ? str + " " + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"' : str;
      }
      function svgCmd(cmd, x, y) {
        let str = cmd + x;
        if (typeof y !== "undefined") str += " " + y;
        return str;
      }
      function qrToPath(data, size, margin) {
        let path = "";
        let moveBy = 0;
        let newRow = false;
        let lineLength = 0;
        for (let i = 0; i < data.length; i++) {
          const col = Math.floor(i % size);
          const row = Math.floor(i / size);
          if (!col && !newRow) newRow = true;
          if (data[i]) {
            lineLength++;
            if (!(i > 0 && col > 0 && data[i - 1])) {
              path += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
              moveBy = 0;
              newRow = false;
            }
            if (!(col + 1 < size && data[i + 1])) {
              path += svgCmd("h", lineLength);
              lineLength = 0;
            }
          } else {
            moveBy++;
          }
        }
        return path;
      }
      exports.render = function render(qrData, options, cb) {
        const opts = Utils.getOptions(options);
        const size = qrData.modules.size;
        const data = qrData.modules.data;
        const qrcodesize = size + opts.margin * 2;
        const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + ' d="M0 0h' + qrcodesize + "v" + qrcodesize + 'H0z"/>';
        const path = "<path " + getColorAttrib(opts.color.dark, "stroke") + ' d="' + qrToPath(data, size, opts.margin) + '"/>';
        const viewBox = 'viewBox="0 0 ' + qrcodesize + " " + qrcodesize + '"';
        const width = !opts.width ? "" : 'width="' + opts.width + '" height="' + opts.width + '" ';
        const svgTag = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path + "</svg>\n";
        if (typeof cb === "function") {
          cb(null, svgTag);
        }
        return svgTag;
      };
    }
  });

  // node_modules/qrcode/lib/browser.js
  var require_browser = __commonJS({
    "node_modules/qrcode/lib/browser.js"(exports) {
      var canPromise = require_can_promise();
      var QRCode2 = require_qrcode();
      var CanvasRenderer = require_canvas();
      var SvgRenderer = require_svg_tag();
      function renderCanvas(renderFunc, canvas, text, opts, cb) {
        const args = [].slice.call(arguments, 1);
        const argsNum = args.length;
        const isLastArgCb = typeof args[argsNum - 1] === "function";
        if (!isLastArgCb && !canPromise()) {
          throw new Error("Callback required as last argument");
        }
        if (isLastArgCb) {
          if (argsNum < 2) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 2) {
            cb = text;
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 3) {
            if (canvas.getContext && typeof cb === "undefined") {
              cb = opts;
              opts = void 0;
            } else {
              cb = opts;
              opts = text;
              text = canvas;
              canvas = void 0;
            }
          }
        } else {
          if (argsNum < 1) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 1) {
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 2 && !canvas.getContext) {
            opts = text;
            text = canvas;
            canvas = void 0;
          }
          return new Promise(function(resolve, reject) {
            try {
              const data = QRCode2.create(text, opts);
              resolve(renderFunc(data, canvas, opts));
            } catch (e2) {
              reject(e2);
            }
          });
        }
        try {
          const data = QRCode2.create(text, opts);
          cb(null, renderFunc(data, canvas, opts));
        } catch (e2) {
          cb(e2);
        }
      }
      exports.create = QRCode2.create;
      exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
      exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
      exports.toString = renderCanvas.bind(null, function(data, _, opts) {
        return SvgRenderer.render(data, opts);
      });
    }
  });

  // node_modules/@solana/errors/dist/index.browser.mjs
  var SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED = 1;
  var SOLANA_ERROR__INVALID_NONCE = 2;
  var SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND = 3;
  var SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE = 4;
  var SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH = 5;
  var SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE = 6;
  var SOLANA_ERROR__MALFORMED_BIGINT_STRING = 7;
  var SOLANA_ERROR__MALFORMED_NUMBER_STRING = 8;
  var SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE = 9;
  var SOLANA_ERROR__MALFORMED_JSON_RPC_ERROR = 10;
  var SOLANA_ERROR__FAILED_TO_SEND_TRANSACTION = 11;
  var SOLANA_ERROR__FAILED_TO_SEND_TRANSACTIONS = 12;
  var SOLANA_ERROR__JSON_RPC__PARSE_ERROR = -32700;
  var SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR = -32603;
  var SOLANA_ERROR__JSON_RPC__INVALID_PARAMS = -32602;
  var SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND = -32601;
  var SOLANA_ERROR__JSON_RPC__INVALID_REQUEST = -32600;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SLOT_HISTORY = -32021;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_FILTER_TRANSACTION_NOT_FOUND = -32020;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_UNREACHABLE = -32019;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_NOT_EPOCH_BOUNDARY = -32018;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_EPOCH_REWARDS_PERIOD_ACTIVE = -32017;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED = -32016;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION = -32015;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET = -32014;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH = -32013;
  var SOLANA_ERROR__JSON_RPC__SCAN_ERROR = -32012;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE = -32011;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX = -32010;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED = -32009;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT = -32008;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED = -32007;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE = -32006;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY = -32005;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE = -32004;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE = -32003;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE = -32002;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP = -32001;
  var SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH = 28e5;
  var SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE = 2800001;
  var SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS = 2800002;
  var SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY = 2800003;
  var SOLANA_ERROR__ADDRESSES__MALFORMED_PDA = 2800004;
  var SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE = 2800005;
  var SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED = 2800006;
  var SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED = 2800007;
  var SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE = 2800008;
  var SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED = 2800009;
  var SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER = 2800010;
  var SOLANA_ERROR__ADDRESSES__INVALID_OFF_CURVE_ADDRESS = 2800011;
  var SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND = 323e4;
  var SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND = 32300001;
  var SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT = 3230002;
  var SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT = 3230003;
  var SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED = 3230004;
  var SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT = 361e4;
  var SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED = 3610001;
  var SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED = 3610002;
  var SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED = 3610003;
  var SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED = 3610004;
  var SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED = 3610005;
  var SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED = 3610006;
  var SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY = 3610007;
  var SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED = 3611e3;
  var SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH = 3704e3;
  var SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH = 3704001;
  var SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH = 3704002;
  var SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE = 3704003;
  var SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY = 3704004;
  var SOLANA_ERROR__KEYS__INVALID_BASE58_IN_GRIND_REGEX = 3704005;
  var SOLANA_ERROR__KEYS__WRITE_KEY_PAIR_UNSUPPORTED_ENVIRONMENT = 3704006;
  var SOLANA_ERROR__FS__UNSUPPORTED_ENVIRONMENT = 3712e3;
  var SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS = 4128e3;
  var SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA = 4128001;
  var SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH = 4128002;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN = 4615e3;
  var SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR = 4615001;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT = 4615002;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA = 4615003;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA = 4615004;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL = 4615005;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS = 4615006;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID = 4615007;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE = 4615008;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED = 4615009;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT = 4615010;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION = 4615011;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID = 4615012;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND = 4615013;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED = 4615014;
  var SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE = 4615015;
  var SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED = 4615016;
  var SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX = 4615017;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED = 4615018;
  var SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED = 4615019;
  var SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS = 4615020;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED = 4615021;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE = 4615022;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED = 4615023;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = 4615024;
  var SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC = 4615025;
  var SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM = 4615026;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR = 4615027;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED = 4615028;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE = 4615029;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT = 4615030;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID = 4615031;
  var SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH = 4615032;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT = 4615033;
  var SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED = 4615034;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED = 4615035;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS = 4615036;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC = 4615037;
  var SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED = 4615038;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION = 4615039;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE = 4615040;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE = 4615041;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE = 4615042;
  var SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE = 4615043;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY = 4615044;
  var SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR = 4615045;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT = 4615046;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER = 4615047;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW = 4615048;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR = 4615049;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER = 4615050;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED = 4615051;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED = 4615052;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED = 4615053;
  var SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS = 4615054;
  var SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS = 5508e3;
  var SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER = 5508001;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER = 5508002;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER = 5508003;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER = 5508004;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER = 5508005;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER = 5508006;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER = 5508007;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER = 5508008;
  var SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS = 5508009;
  var SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING = 5508010;
  var SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED = 5508011;
  var SOLANA_ERROR__SIGNER__WALLET_ACCOUNT_CANNOT_SIGN_TRANSACTION = 5508012;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED = 5607e3;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__RESTRICTED_ASCII_BODY_CHARACTER_OUT_OF_RANGE = 5607001;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__APPLICATION_DOMAIN_STRING_LENGTH_OUT_OF_RANGE = 5607002;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__INVALID_APPLICATION_DOMAIN_BYTE_LENGTH = 5607003;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_SIGNATURES_MISMATCH = 5607004;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO = 5607005;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED = 5607006;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH = 5607007;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_LENGTH_MISMATCH = 5607008;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY = 5607009;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO = 5607010;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURES_MISSING = 5607011;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__ENVELOPE_SIGNERS_MISMATCH = 5607012;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__ADDRESSES_CANNOT_SIGN_OFFCHAIN_MESSAGE = 5607013;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__UNEXPECTED_VERSION = 5607014;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_SORTED = 5607015;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_UNIQUE = 5607016;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE = 5607017;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__CONTENT_DOES_NOT_MATCH_EXPECTED = 5607018;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__REQUIRED_SIGNATORIES_DO_NOT_MATCH_EXPECTED = 5607019;
  var SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES = 5663e3;
  var SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE = 5663001;
  var SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME = 5663002;
  var SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME = 5663003;
  var SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE = 5663004;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING = 5663005;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE = 5663006;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND = 5663007;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING = 5663008;
  var SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING = 5663009;
  var SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING = 5663010;
  var SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING = 5663011;
  var SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING = 5663012;
  var SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING = 5663013;
  var SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE = 5663014;
  var SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION = 5663015;
  var SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES = 5663016;
  var SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH = 5663017;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT = 5663018;
  var SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT = 5663019;
  var SOLANA_ERROR__TRANSACTION__EXCEEDS_SIZE_LIMIT = 5663020;
  var SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_NOT_SUPPORTED = 5663021;
  var SOLANA_ERROR__TRANSACTION__NONCE_ACCOUNT_CANNOT_BE_IN_LOOKUP_TABLE = 5663022;
  var SOLANA_ERROR__TRANSACTION__MALFORMED_MESSAGE_BYTES = 5663023;
  var SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_MESSAGE_BYTES = 5663024;
  var SOLANA_ERROR__TRANSACTION__CANNOT_DECODE_EMPTY_TRANSACTION_BYTES = 5663025;
  var SOLANA_ERROR__TRANSACTION__VERSION_ZERO_MUST_BE_ENCODED_WITH_SIGNATURES_FIRST = 5663026;
  var SOLANA_ERROR__TRANSACTION__SIGNATURE_COUNT_TOO_HIGH_FOR_TRANSACTION_BYTES = 5663027;
  var SOLANA_ERROR__TRANSACTION__INVALID_CONFIG_MASK_PRIORITY_FEE_BITS = 5663028;
  var SOLANA_ERROR__TRANSACTION__INVALID_NONCE_ACCOUNT_INDEX = 5663029;
  var SOLANA_ERROR__TRANSACTION__INVALID_CONFIG_VALUE_KIND = 5663030;
  var SOLANA_ERROR__TRANSACTION__INSTRUCTION_HEADERS_PAYLOADS_MISMATCH = 5663031;
  var SOLANA_ERROR__TRANSACTION__TOO_MANY_SIGNER_ADDRESSES = 5663032;
  var SOLANA_ERROR__TRANSACTION__TOO_MANY_ACCOUNT_ADDRESSES = 5663033;
  var SOLANA_ERROR__TRANSACTION__TOO_MANY_INSTRUCTIONS = 5663034;
  var SOLANA_ERROR__TRANSACTION__TOO_MANY_ACCOUNTS_IN_INSTRUCTION = 5663035;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 5663036;
  var SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_RESOURCE_LIMITS = 5663037;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_ACCOUNT_INDEX_OUT_OF_RANGE = 5663038;
  var SOLANA_ERROR__TRANSACTION_INTROSPECTION__CANNOT_DECODE_JSON_PARSED_TRANSACTION = 5664e3;
  var SOLANA_ERROR__TRANSACTION_INTROSPECTION__UNRECOGNIZED_GET_TRANSACTION_RESPONSE = 5664001;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN = 705e4;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE = 7050001;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE = 7050002;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND = 7050003;
  var SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND = 7050004;
  var SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE = 7050005;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE = 7050006;
  var SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED = 7050007;
  var SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND = 7050008;
  var SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP = 7050009;
  var SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE = 7050010;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX = 7050011;
  var SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE = 7050012;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION = 7050013;
  var SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE = 7050014;
  var SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE = 7050015;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = 7050016;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT = 7050017;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION = 7050018;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT = 7050019;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT = 7050020;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT = 7050021;
  var SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS = 7050022;
  var SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND = 7050023;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER = 7050024;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA = 7050025;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX = 7050026;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT = 7050027;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT = 7050028;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT = 7050029;
  var SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION = 7050030;
  var SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT = 7050031;
  var SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED = 7050032;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 7050033;
  var SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED = 7050034;
  var SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED = 7050035;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION = 7050036;
  var SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN = 7618e3;
  var SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_PACKER_ALREADY_COMPLETE = 7618001;
  var SOLANA_ERROR__INSTRUCTION_PLANS__EMPTY_INSTRUCTION_PLAN = 7618002;
  var SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN = 7618003;
  var SOLANA_ERROR__INSTRUCTION_PLANS__NON_DIVISIBLE_TRANSACTION_PLANS_NOT_SUPPORTED = 7618004;
  var SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_SINGLE_TRANSACTION_PLAN_RESULT_NOT_FOUND = 7618005;
  var SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN = 7618006;
  var SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN = 7618007;
  var SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT = 7618008;
  var SOLANA_ERROR__INSTRUCTION_PLANS__EXPECTED_SUCCESSFUL_TRANSACTION_PLAN_RESULT = 7618009;
  var SOLANA_ERROR__INSTRUCTION_PLANS__MAX_INSTRUCTIONS_PER_TRANSACTION_EXCEEDED = 7618010;
  var SOLANA_ERROR__INSTRUCTION_PLANS__INVALID_MAX_INSTRUCTIONS_PER_TRANSACTION = 7618011;
  var SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY = 8078e3;
  var SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH = 8078001;
  var SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH = 8078002;
  var SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH = 8078003;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH = 8078004;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH = 8078005;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH = 8078006;
  var SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS = 8078007;
  var SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE = 8078008;
  var SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT = 8078009;
  var SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT = 8078010;
  var SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE = 8078011;
  var SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE = 8078012;
  var SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH = 8078013;
  var SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE = 8078014;
  var SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT = 8078015;
  var SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE = 8078016;
  var SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE = 8078017;
  var SOLANA_ERROR__CODECS__INVALID_CONSTANT = 8078018;
  var SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE = 8078019;
  var SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL = 8078020;
  var SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES = 8078021;
  var SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS = 8078022;
  var SOLANA_ERROR__CODECS__EXPECTED_DECODER_TO_CONSUME_ENTIRE_BYTE_ARRAY = 8078023;
  var SOLANA_ERROR__CODECS__INVALID_PATTERN_MATCH_VALUE = 8078024;
  var SOLANA_ERROR__CODECS__INVALID_PATTERN_MATCH_BYTES = 8078025;
  var SOLANA_ERROR__FIXED_POINTS__INVALID_TOTAL_BITS = 809e4;
  var SOLANA_ERROR__FIXED_POINTS__INVALID_FRACTIONAL_BITS = 8090001;
  var SOLANA_ERROR__FIXED_POINTS__INVALID_DECIMALS = 8090002;
  var SOLANA_ERROR__FIXED_POINTS__FRACTIONAL_BITS_EXCEED_TOTAL_BITS = 8090003;
  var SOLANA_ERROR__FIXED_POINTS__VALUE_OUT_OF_RANGE = 8090004;
  var SOLANA_ERROR__FIXED_POINTS__INVALID_STRING = 8090005;
  var SOLANA_ERROR__FIXED_POINTS__INVALID_ZERO_DENOMINATOR_RATIO = 8090006;
  var SOLANA_ERROR__FIXED_POINTS__ARITHMETIC_OVERFLOW = 8090007;
  var SOLANA_ERROR__FIXED_POINTS__SHAPE_MISMATCH = 8090008;
  var SOLANA_ERROR__FIXED_POINTS__DIVISION_BY_ZERO = 8090009;
  var SOLANA_ERROR__FIXED_POINTS__STRICT_MODE_PRECISION_LOSS = 8090010;
  var SOLANA_ERROR__FIXED_POINTS__MALFORMED_RAW_VALUE = 8090011;
  var SOLANA_ERROR__FIXED_POINTS__TOTAL_BITS_NOT_BYTE_ALIGNED = 8090012;
  var SOLANA_ERROR__RPC__INTEGER_OVERFLOW = 81e5;
  var SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN = 8100001;
  var SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR = 8100002;
  var SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD = 8100003;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN = 819e4;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID = 8190001;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED = 8190002;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED = 8190003;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT = 8190004;
  var SOLANA_ERROR__SUBSCRIBABLE__RETRY_NOT_SUPPORTED = 8195e3;
  var SOLANA_ERROR__SUBSCRIBABLE__STREAM_CLOSED_WITHOUT_ERROR = 8195001;
  var SOLANA_ERROR__PROGRAM_CLIENTS__INSUFFICIENT_ACCOUNT_METAS = 85e5;
  var SOLANA_ERROR__PROGRAM_CLIENTS__UNRECOGNIZED_INSTRUCTION_TYPE = 8500001;
  var SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_INSTRUCTION = 8500002;
  var SOLANA_ERROR__PROGRAM_CLIENTS__UNEXPECTED_RESOLVED_INSTRUCTION_INPUT_TYPE = 8500003;
  var SOLANA_ERROR__PROGRAM_CLIENTS__RESOLVED_INSTRUCTION_INPUT_MUST_BE_NON_NULL = 8500004;
  var SOLANA_ERROR__PROGRAM_CLIENTS__UNRECOGNIZED_ACCOUNT_TYPE = 8500005;
  var SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_ACCOUNT = 8500006;
  var SOLANA_ERROR__WALLET__NOT_CONNECTED = 89e5;
  var SOLANA_ERROR__WALLET__NO_SIGNER_CONNECTED = 8900001;
  var SOLANA_ERROR__WALLET__SIGNER_NOT_AVAILABLE = 8900002;
  var SOLANA_ERROR__WALLET__ACCOUNT_NOT_AVAILABLE = 8900003;
  var SOLANA_ERROR__REACT__MISSING_PROVIDER = 9e6;
  var SOLANA_ERROR__REACT__MISSING_CAPABILITY = 9000001;
  var SOLANA_ERROR__REACT__SUBSCRIPTION_CLOSED_WITHOUT_ERROR = 9000002;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING = 99e5;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE = 9900001;
  var SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING = 9900002;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE = 9900003;
  var SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED = 9900004;
  var SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND = 9900005;
  var SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_TRANSACTION_PLAN_KIND = 9900006;
  var SolanaErrorMessages = {
    [SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND]: "Account not found at address: $address",
    [SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED]: "Not all accounts were decoded. Encoded accounts found at addresses: $addresses.",
    [SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT]: "Expected decoded account at address: $address",
    [SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT]: "Failed to decode account data at address: $address",
    [SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND]: "Accounts not found at addresses: $addresses",
    [SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED]: "Unable to find a viable program address bump seed.",
    [SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS]: "$putativeAddress is not a base58-encoded address.",
    [SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH]: "Expected base58 encoded address to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY]: "The `CryptoKey` must be an `Ed25519` public key.",
    [SOLANA_ERROR__ADDRESSES__INVALID_OFF_CURVE_ADDRESS]: "$putativeOffCurveAddress is not a base58-encoded off-curve address.",
    [SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE]: "Invalid seeds; point must fall off the Ed25519 curve.",
    [SOLANA_ERROR__ADDRESSES__MALFORMED_PDA]: "Expected given program derived address to have the following format: [Address, ProgramDerivedAddressBump].",
    [SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED]: "A maximum of $maxSeeds seeds, including the bump seed, may be supplied when creating an address. Received: $actual.",
    [SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED]: "The seed at index $index with length $actual exceeds the maximum length of $maxSeedLength bytes.",
    [SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE]: "Expected program derived address bump to be in the range [0, 255], got: $bump.",
    [SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER]: "Program address cannot end with PDA marker.",
    [SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded address string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded blockhash string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED]: "The network has progressed past the last block for which this transaction could have been committed.",
    [SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY]: "Codec [$codecDescription] cannot decode empty byte arrays.",
    [SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS]: "Enum codec cannot use lexical values [$stringValues] as discriminators. Either remove all lexical values or set `useValuesAsDiscriminators` to `false`.",
    [SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL]: "Sentinel [$hexSentinel] must not be present in encoded bytes [$hexEncodedBytes].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH]: "Encoder and decoder must have the same fixed size, got [$encoderFixedSize] and [$decoderFixedSize].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH]: "Encoder and decoder must have the same max size, got [$encoderMaxSize] and [$decoderMaxSize].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH]: "Encoder and decoder must either both be fixed-size or variable-size.",
    [SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE]: "Enum discriminator out of range. Expected a number in [$formattedValidDiscriminators], got $discriminator.",
    [SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH]: "Expected a fixed-size codec, got a variable-size one.",
    [SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH]: "Codec [$codecDescription] expected a positive byte length, got $bytesLength.",
    [SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH]: "Expected a variable-size codec, got a fixed-size one.",
    [SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE]: "Codec [$codecDescription] expected zero-value [$hexZeroValue] to have the same size as the provided fixed-size item [$expectedSize bytes].",
    [SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH]: "Codec [$codecDescription] expected $expected bytes, got $bytesLength.",
    [SOLANA_ERROR__CODECS__INVALID_CONSTANT]: "Expected byte array constant [$hexConstant] to be present in data [$hexData] at offset [$offset].",
    [SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT]: "Invalid discriminated union variant. Expected one of [$variants], got $value.",
    [SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT]: "Invalid enum variant. Expected one of [$stringValues] or a number in [$formattedNumericalValues], got $variant.",
    [SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT]: "Invalid literal union variant. Expected one of [$variants], got $value.",
    [SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS]: "Expected [$codecDescription] to have $expected items, got $actual.",
    [SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE]: "Invalid value $value for base $base with alphabet $alphabet.",
    [SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE]: "Literal union discriminator out of range. Expected a number between $minRange and $maxRange, got $discriminator.",
    [SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE]: "Codec [$codecDescription] expected number to be in the range [$min, $max], got $value.",
    [SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE]: "Codec [$codecDescription] expected offset to be in the range [0, $bytesLength], got $offset.",
    [SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES]: "Expected sentinel [$hexSentinel] to be present in decoded bytes [$hexDecodedBytes].",
    [SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE]: "Union variant out of range. Expected an index between $minRange and $maxRange, got $variant.",
    [SOLANA_ERROR__CODECS__EXPECTED_DECODER_TO_CONSUME_ENTIRE_BYTE_ARRAY]: "This decoder expected a byte array of exactly $expectedLength bytes, but $numExcessBytes unexpected excess bytes remained after decoding. Are you sure that you have chosen the correct decoder for this data?",
    [SOLANA_ERROR__CODECS__INVALID_PATTERN_MATCH_VALUE]: "Invalid pattern match value. The provided value does not match any of the specified patterns.",
    [SOLANA_ERROR__CODECS__INVALID_PATTERN_MATCH_BYTES]: "Invalid pattern match bytes. The provided byte array does not match any of the specified patterns.",
    [SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED]: "No random values implementation could be found.",
    [SOLANA_ERROR__FAILED_TO_SEND_TRANSACTION]: "Failed to send transaction$causeMessage",
    [SOLANA_ERROR__FAILED_TO_SEND_TRANSACTIONS]: "Failed to send transactions$causeMessages",
    [SOLANA_ERROR__FIXED_POINTS__ARITHMETIC_OVERFLOW]: "Fixed-point operation `$operation` of kind `$kind` overflowed. Expected a raw bigint in [$min, $max], got $result.",
    [SOLANA_ERROR__FIXED_POINTS__DIVISION_BY_ZERO]: "Fixed-point division by zero for value of kind `$kind` ($signedness, $totalBits bits).",
    [SOLANA_ERROR__FIXED_POINTS__FRACTIONAL_BITS_EXCEED_TOTAL_BITS]: "`fractionalBits` ($fractionalBits) must not exceed `totalBits` ($totalBits).",
    [SOLANA_ERROR__FIXED_POINTS__INVALID_DECIMALS]: "Invalid `decimals`. Expected a non-negative integer, got $decimals.",
    [SOLANA_ERROR__FIXED_POINTS__INVALID_FRACTIONAL_BITS]: "Invalid `fractionalBits`. Expected a non-negative integer, got $fractionalBits.",
    [SOLANA_ERROR__FIXED_POINTS__INVALID_STRING]: "Invalid string `$input` for fixed-point value of kind `$kind`.",
    [SOLANA_ERROR__FIXED_POINTS__INVALID_TOTAL_BITS]: "Invalid `totalBits`. Expected a positive integer, got $totalBits.",
    [SOLANA_ERROR__FIXED_POINTS__INVALID_ZERO_DENOMINATOR_RATIO]: "Invalid ratio $numerator/$denominator for fixed-point value of kind `$kind`. Denominator must be non-zero.",
    [SOLANA_ERROR__FIXED_POINTS__MALFORMED_RAW_VALUE]: "Fixed-point value of kind `$kind` has a malformed `raw` field. Expected a bigint, got `$raw`.",
    [SOLANA_ERROR__FIXED_POINTS__SHAPE_MISMATCH]: "Fixed-point `$operation` operation expected $expectedKind ($expectedSignedness, $expectedTotalBits bits, $expectedScale $expectedScaleLabel); got $actualKind ($actualSignedness, $actualTotalBits bits, $actualScale $actualScaleLabel).",
    [SOLANA_ERROR__FIXED_POINTS__STRICT_MODE_PRECISION_LOSS]: "Fixed-point operation `$operation` of kind `$kind` cannot be performed exactly; pass a rounding mode other than `strict` to allow a rounded result.",
    [SOLANA_ERROR__FIXED_POINTS__TOTAL_BITS_NOT_BYTE_ALIGNED]: "Fixed-point codec of kind `$kind` requires `totalBits` to be a multiple of 8; got $totalBits.",
    [SOLANA_ERROR__FIXED_POINTS__VALUE_OUT_OF_RANGE]: "Fixed-point value of kind `$kind` is out of range for $signedness $totalBits-bit storage. Expected a raw bigint in [$min, $max], got $raw.",
    [SOLANA_ERROR__FS__UNSUPPORTED_ENVIRONMENT]: "Filesystem operation `$operation` is not supported in this environment.",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED]: "Instruction requires an uninitialized account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED]: "Instruction tries to borrow reference for an account which is already borrowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING]: "Instruction left account with an outstanding borrowed reference",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED]: "Program other than the account's owner changed the size of the account data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL]: "Account data too small for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE]: "Instruction expected an executable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT]: "An account does not have enough lamports to be rent-exempt",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW]: "Program arithmetic overflowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR]: "Failed to serialize or deserialize account data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS]: "Builtin programs must consume compute units",
    [SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH]: "Cross-program invocation call depth too deep",
    [SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED]: "Computational budget exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM]: "Custom program error: #$code",
    [SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX]: "Instruction contains duplicate accounts",
    [SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC]: "Instruction modifications of multiply-passed account differ",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT]: "Executable accounts must be rent exempt",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED]: "Instruction changed executable accounts data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE]: "Instruction changed the balance of an executable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED]: "Instruction changed executable bit of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED]: "Instruction modified data of an account it does not own",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND]: "Instruction spent from the balance of an account it does not own",
    [SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR]: "Generic instruction error",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER]: "Provided owner is not allowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE]: "Account is immutable",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY]: "Incorrect authority provided",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID]: "Incorrect program id for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS]: "Insufficient funds for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA]: "Invalid account data for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER]: "Invalid account owner",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT]: "Invalid program argument",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR]: "Program returned invalid error code",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA]: "Invalid instruction data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC]: "Failed to reallocate account data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS]: "Provided seeds do not result in a valid address",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED]: "Accounts data allocations exceeded the maximum allowed per transaction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED]: "Max accounts exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED]: "Max instruction trace length exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED]: "Length of the seed is too long for address generation",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT]: "An account required by the instruction is missing",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE]: "Missing required signature for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID]: "Instruction illegally modified the program id of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS]: "Insufficient account keys for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION]: "Cross-program invocation with unauthorized signer or writable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE]: "Failed to create program execution environment",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE]: "Program failed to compile",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE]: "Program failed to complete",
    [SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED]: "Instruction modified data of a read-only account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE]: "Instruction changed the balance of a read-only account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED]: "Cross-program invocation reentrancy not allowed for this instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED]: "Instruction modified rent epoch of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION]: "Sum of account balances before and after instruction do not match",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT]: "Instruction requires an initialized account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN]: "The instruction failed with the error: $errorName",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID]: "Unsupported program id",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR]: "Unsupported sysvar",
    [SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND]: "Invalid instruction plan kind: $kind.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__EMPTY_INSTRUCTION_PLAN]: "The provided instruction plan is empty.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_SINGLE_TRANSACTION_PLAN_RESULT_NOT_FOUND]: "No failed transaction plan result was found in the provided transaction plan result.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__NON_DIVISIBLE_TRANSACTION_PLANS_NOT_SUPPORTED]: "This transaction plan executor does not support non-divisible sequential plans. To support them, you may create your own executor such that multi-transaction atomicity is preserved \u2014 e.g. by targetting RPCs that support transaction bundles.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN]: "The provided transaction plan failed to execute. See the `transactionPlanResult` attribute for more details. Note that the `cause` property is deprecated, and a future version will not set it.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__INVALID_MAX_INSTRUCTIONS_PER_TRANSACTION]: "The configured maximum of $maxInstructions instructions per transaction is invalid. It must be a positive integer no greater than the transaction format limit of $transactionInstructionLimit instructions per transaction. Provide a `maxInstructionsPerTransaction` (on the transaction planner) or `maxInstructions` (on the message packer) value between 1 and $transactionInstructionLimit.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__MAX_INSTRUCTIONS_PER_TRANSACTION_EXCEEDED]: "Planning this transaction message would require $numInstructions instructions, which exceeds the configured maximum of $maxInstructions instructions per transaction. This limit is configurable, and intended to leave headroom for inner instructions which are included in the maximum instruction limit for transactions. Increase `maxInstructionsPerTransaction` on the transaction planner (or `maxInstructions` on the message packer) to allow more instructions per transaction.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN]: "The provided message has insufficient capacity to accommodate the next instruction(s) in this plan. Expected at least $numBytesRequired free byte(s), got $numFreeBytes byte(s).",
    [SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_TRANSACTION_PLAN_KIND]: "Invalid transaction plan kind: $kind.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_PACKER_ALREADY_COMPLETE]: "No more instructions to pack; the message packer has completed the instruction plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN]: "Unexpected instruction plan. Expected $expectedKind plan, got $actualKind plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN]: "Unexpected transaction plan. Expected $expectedKind plan, got $actualKind plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT]: "Unexpected transaction plan result. Expected $expectedKind plan, got $actualKind plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__EXPECTED_SUCCESSFUL_TRANSACTION_PLAN_RESULT]: "Expected a successful transaction plan result. I.e. there is at least one failed or cancelled transaction in the plan.",
    [SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS]: "The instruction does not have any accounts.",
    [SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA]: "The instruction does not have any data.",
    [SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH]: "Expected instruction to have progress address $expectedProgramAddress, got $actualProgramAddress.",
    [SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH]: "Expected base58 encoded blockhash to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__INVALID_NONCE]: "The nonce `$expectedNonceValue` is no longer valid. It has advanced to `$actualNonceValue`",
    [SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING]: "Invariant violation: Found no abortable iterable cache entry for key `$cacheKey`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED]: "Invariant violation: This data publisher does not publish to the channel named `$channelName`. Supported channels include $supportedChannelNames.",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE]: "Invariant violation: WebSocket message iterator state is corrupt; iterated without first resolving existing message promise. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING]: "Invariant violation: WebSocket message iterator is missing state storage. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE]: "Invariant violation: Switch statement non-exhaustive. Received unexpected value `$unexpectedValue`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR]: "JSON-RPC error: Internal JSON-RPC error ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__INVALID_PARAMS]: "JSON-RPC error: Invalid method parameter(s) ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__INVALID_REQUEST]: "JSON-RPC error: The JSON sent is not a valid `Request` object ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND]: "JSON-RPC error: The method does not exist / is not available ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__PARSE_ERROR]: "JSON-RPC error: An error occurred on the server while parsing the JSON text ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__SCAN_ERROR]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_EPOCH_REWARDS_PERIOD_ACTIVE]: "Epoch rewards period still active at slot $slot",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_FILTER_TRANSACTION_NOT_FOUND]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_UNREACHABLE]: "Failed to query long-term storage; please try again",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED]: "Minimum context slot has not been reached",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY]: "Node is unhealthy; behind by $numSlotsBehind slots",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SLOT_HISTORY]: "No slot history",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT]: "No snapshot",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE]: "Transaction simulation failed",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_NOT_EPOCH_BOUNDARY]: "Rewards cannot be found because slot $slot is not the epoch boundary. This may be due to gap in the queried node's local ledger or long-term storage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE]: "Transaction history is not available from this node",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH]: "Transaction signature length mismatch",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE]: "Transaction signature verification failure",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION]: "$__serverMessage",
    [SOLANA_ERROR__KEYS__INVALID_BASE58_IN_GRIND_REGEX]: "The grind regex `/$source/` contains the character `$character`, which is not in the base58 alphabet and can never match a Solana address.",
    [SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH]: "Key pair bytes must be of length 64, got $byteLength.",
    [SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH]: "Expected private key bytes with length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH]: "Expected base58-encoded signature to decode to a byte array of length 64. Actual length: $actualLength.",
    [SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY]: "The provided private key does not match the provided public key.",
    [SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded signature string of length in the range [64, 88]. Actual length: $actualLength.",
    [SOLANA_ERROR__KEYS__WRITE_KEY_PAIR_UNSUPPORTED_ENVIRONMENT]: "Writing a key pair to disk is not supported in this environment.",
    [SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE]: "Lamports value must be in the range [0, 2e64-1]",
    [SOLANA_ERROR__MALFORMED_BIGINT_STRING]: "`$value` cannot be parsed as a `BigInt`",
    [SOLANA_ERROR__MALFORMED_JSON_RPC_ERROR]: "$message",
    [SOLANA_ERROR__MALFORMED_NUMBER_STRING]: "`$value` cannot be parsed as a `Number`",
    [SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND]: "No nonce account could be found at address `$nonceAccountAddress`",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__INVALID_APPLICATION_DOMAIN_BYTE_LENGTH]: "Expected base58 encoded application domain to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__ADDRESSES_CANNOT_SIGN_OFFCHAIN_MESSAGE]: "Attempted to sign an offchain message with an address that is not a signer for it",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__APPLICATION_DOMAIN_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded application domain string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__CONTENT_DOES_NOT_MATCH_EXPECTED]: "The content of the offchain message does not match the content that was expected. Expected content with a byte-length of $expectedBytes; got content with a byte-length of $actualBytes. The signer may have signed different data than was requested; do not trust its signature.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__ENVELOPE_SIGNERS_MISMATCH]: "The signer addresses in this offchain message envelope do not match the list of required signers in the message preamble. These unexpected signers were present in the envelope: `[$unexpectedSigners]`. These required signers were missing from the envelope `[$missingSigners]`.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED]: "The message body provided has a byte-length of $actualBytes. The maximum allowable byte-length is $maxBytes",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH]: "Expected message format $expectedMessageFormat, got $actualMessageFormat",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_LENGTH_MISMATCH]: "The message length specified in the message preamble is $specifiedLength bytes. The actual length of the message is $actualLength bytes.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY]: "Offchain message content must be non-empty",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO]: "Offchain message must specify the address of at least one required signer",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO]: "Offchain message envelope must reserve space for at least one signature",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_SIGNATURES_MISMATCH]: "The offchain message preamble specifies $numRequiredSignatures required signature(s), got $signaturesLength.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__REQUIRED_SIGNATORIES_DO_NOT_MATCH_EXPECTED]: "The offchain message lists different required signatories than was expected. Expected [$expectedAddresses]. Got [$actualAddresses]. The signer may have signed different data than was requested; do not trust its signature.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_SORTED]: "The signatories of this offchain message must be listed in lexicographical order",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_UNIQUE]: "An address must be listed no more than once among the signatories of an offchain message",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURES_MISSING]: "Offchain message is missing signatures for addresses: $addresses.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE]: "Offchain message signature verification failed. Signature mismatch for required signatories [$signatoriesWithInvalidSignatures]. Missing signatures for signatories [$signatoriesWithMissingSignatures]",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__RESTRICTED_ASCII_BODY_CHARACTER_OUT_OF_RANGE]: "The message body provided contains characters whose codes fall outside the allowed range. In order to ensure clear-signing compatiblity with hardware wallets, the message may only contain line feeds and characters in the range [\\x20-\\x7e].",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__UNEXPECTED_VERSION]: "Expected offchain message version $expectedVersion. Got $actualVersion.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED]: "This version of Kit does not support decoding offchain messages with version $unsupportedVersion. The current max supported version is 0.",
    [SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_ACCOUNT]: "The provided account could not be identified as an account from the $programName program.",
    [SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_INSTRUCTION]: "The provided instruction could not be identified as an instruction from the $programName program.",
    [SOLANA_ERROR__PROGRAM_CLIENTS__INSUFFICIENT_ACCOUNT_METAS]: "The provided instruction is missing some accounts. Expected at least $expectedAccountMetas account(s), got $actualAccountMetas.",
    [SOLANA_ERROR__PROGRAM_CLIENTS__RESOLVED_INSTRUCTION_INPUT_MUST_BE_NON_NULL]: "Expected resolved instruction input '$inputName' to be non-null.",
    [SOLANA_ERROR__PROGRAM_CLIENTS__UNEXPECTED_RESOLVED_INSTRUCTION_INPUT_TYPE]: "Expected resolved instruction input '$inputName' to be of type `$expectedType`.",
    [SOLANA_ERROR__PROGRAM_CLIENTS__UNRECOGNIZED_ACCOUNT_TYPE]: "Unrecognized account type '$accountType' for the $programName program.",
    [SOLANA_ERROR__PROGRAM_CLIENTS__UNRECOGNIZED_INSTRUCTION_TYPE]: "Unrecognized instruction type '$instructionType' for the $programName program.",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN]: "The notification name must end in 'Notifications' and the API must supply a subscription plan creator function for the notification '$notificationName'.",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED]: "WebSocket was closed before payload could be added to the send buffer",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED]: "WebSocket connection closed",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT]: "WebSocket failed to connect",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID]: "Failed to obtain a subscription id from the server",
    [SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD]: "Could not find an API plan for RPC method: `$method`",
    [SOLANA_ERROR__RPC__INTEGER_OVERFLOW]: "The $argumentLabel argument to the `$methodName` RPC method$optionalPathLabel was `$value`. This number is unsafe for use with the Solana JSON-RPC because it exceeds `Number.MAX_SAFE_INTEGER`.",
    [SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR]: "HTTP error ($statusCode): $message",
    [SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN]: "HTTP header(s) forbidden: $headers. Learn more at https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name.",
    [SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS]: "Multiple distinct signers were identified for address `$address`. Please ensure that you are using the same signer instance for each address.",
    [SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER]: "The provided value does not implement the `KeyPairSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER]: "The provided value does not implement the `MessageModifyingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER]: "The provided value does not implement the `MessagePartialSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER]: "The provided value does not implement any of the `MessageSigner` interfaces",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER]: "The provided value does not implement the `TransactionModifyingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER]: "The provided value does not implement the `TransactionPartialSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER]: "The provided value does not implement the `TransactionSendingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER]: "The provided value does not implement any of the `TransactionSigner` interfaces",
    [SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS]: "More than one `TransactionSendingSigner` was identified.",
    [SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING]: "No `TransactionSendingSigner` was identified. Please provide a valid `TransactionWithSingleSendingSigner` transaction.",
    [SOLANA_ERROR__SIGNER__WALLET_ACCOUNT_CANNOT_SIGN_TRANSACTION]: "The wallet account $address cannot be used to create a transaction signer because it does not implement either the `solana:signTransaction` or `solana:signAndSendTransaction` feature. At least one of these features is required. The account supports the following features: $supportedFeatures.",
    [SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED]: "Wallet account signers do not support signing multiple messages/transactions in a single operation",
    [SOLANA_ERROR__SUBSCRIBABLE__RETRY_NOT_SUPPORTED]: "This `ReactiveStreamStore` does not support retry. Use `createReactiveStoreFromDataPublisherFactory` to construct a retryable store.",
    [SOLANA_ERROR__SUBSCRIBABLE__STREAM_CLOSED_WITHOUT_ERROR]: "The stream store closed in an error state but did not report an error.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY]: "Cannot export a non-extractable key.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED]: "No digest implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT]: "Cryptographic operations are only allowed in secure browser contexts. Read more here: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED]: "This runtime does not support the generation of Ed25519 key pairs.\n\nInstall @solana/webcrypto-ed25519-polyfill and call its `install` function before generating keys in environments that do not support Ed25519.\n\nFor a list of runtimes that currently support Ed25519 operations, visit https://github.com/WICG/webcrypto-secure-curves/issues/20.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED]: "No key export implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED]: "No key generation implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED]: "No signing implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED]: "No signature verification implementation could be found.",
    [SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE]: "Timestamp value must be in the range [-(2n ** 63n), (2n ** 63n) - 1]. `$value` given",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING]: "Transaction processing left an account with an outstanding borrowed reference",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE]: "Account in use",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE]: "Account loaded twice",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND]: "Attempt to debit an account but found no record of a prior credit.",
    [SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND]: "Transaction loads an address table account that doesn't exist",
    [SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED]: "This transaction has already been processed",
    [SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND]: "Blockhash not found",
    [SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP]: "Loader call chain is too deep",
    [SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE]: "Transactions are currently disabled due to cluster maintenance",
    [SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION]: "Transaction contains a duplicate instruction ($index) that is not allowed",
    [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE]: "Insufficient funds for fee",
    [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT]: "Transaction results in an account ($accountIndex) with insufficient funds for rent",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE]: "This account may not be used to pay transaction fees",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX]: "Transaction contains an invalid account reference",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA]: "Transaction loads an address table account with invalid data",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX]: "Transaction address table lookup uses an invalid index",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER]: "Transaction loads an address table account with an invalid owner",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT]: "LoadedAccountsDataSizeLimit set for transaction must be greater than 0.",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION]: "This program may not be used for executing instructions",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT]: "Transaction leaves an account with a lower balance than rent-exempt minimum",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT]: "Transaction loads a writable account that cannot be written",
    [SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED]: "Transaction exceeded max loaded accounts data size cap",
    [SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE]: "Transaction requires a fee but has no signature present",
    [SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND]: "Attempt to load a program that does not exist",
    [SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED]: "Execution of the program referenced by account at index $accountIndex is temporarily restricted.",
    [SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED]: "ResanitizationNeeded",
    [SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE]: "Transaction failed to sanitize accounts offsets correctly",
    [SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE]: "Transaction did not pass signature verification",
    [SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS]: "Transaction locked too many accounts",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION]: "Sum of account balances before and after transaction do not match",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN]: "The transaction failed with the error `$errorName`",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION]: "Transaction version is unsupported",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT]: "Transaction would exceed account data limit within the block",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT]: "Transaction would exceed total account data limit",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT]: "Transaction would exceed max account limit within the block",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT]: "Transaction would exceed max Block Cost Limit",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT]: "Transaction would exceed max Vote Cost Limit",
    [SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION]: "Attempted to sign a transaction with an address that is not a signer for it",
    [SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING]: "Transaction is missing an address at index: $index.",
    [SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES]: "Transaction has no expected signers therefore it cannot be encoded",
    [SOLANA_ERROR__TRANSACTION__EXCEEDS_SIZE_LIMIT]: "Transaction size $transactionSize exceeds limit of $transactionSizeLimit bytes",
    [SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME]: "Transaction does not have a blockhash lifetime",
    [SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME]: "Transaction is not a durable nonce transaction",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING]: "Contents of these address lookup tables unknown: $lookupTableAddresses",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE]: "Lookup of address at index $highestRequestedIndex failed for lookup table `$lookupTableAddress`. Highest known index is $highestKnownIndex. The lookup table may have been extended since its contents were retrieved",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING]: "No fee payer set in CompiledTransaction",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND]: "Could not find program address at index $index",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT]: "Failed to estimate the compute unit consumption for this transaction message. This is likely because simulating the transaction failed. Inspect the `cause` property of this error to learn more",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_LOADED_ACCOUNTS_DATA_SIZE_LIMIT]: "Failed to estimate the loaded accounts data size for this transaction message. The RPC did not return a `loadedAccountsDataSize` value from simulation. This value is required for version 1 transactions",
    [SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT]: "Transaction failed when it was simulated in order to estimate the compute unit consumption. The compute unit estimate provided is for a transaction that failed when simulated and may not be representative of the compute units this transaction would consume if successful. Inspect the `cause` property of this error to learn more",
    [SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_RESOURCE_LIMITS]: "Transaction failed when it was simulated in order to estimate its resource limits. The resource limit estimates provided are for a transaction that failed when simulated and may not be representative of the resources this transaction would consume if successful. Inspect the `cause` property of this error to learn more",
    [SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING]: "Transaction is missing a fee payer.",
    [SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING]: "Could not determine this transaction's signature. Make sure that the transaction has been signed by its fee payer.",
    [SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE]: "Transaction first instruction is not advance nonce account instruction.",
    [SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING]: "Transaction with no instructions cannot be durable nonce transaction.",
    [SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES]: "This transaction includes an address (`$programAddress`) which is both invoked and set as the fee payer. Program addresses may not pay fees",
    [SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE]: "This transaction includes an address (`$programAddress`) which is both invoked and marked writable. Program addresses may not be writable",
    [SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH]: "The transaction message expected the transaction to have $numRequiredSignatures signatures, got $signaturesLength.",
    [SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING]: "Transaction is missing signatures for addresses: $addresses.",
    [SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE]: "Transaction version must be in the range [0, 127]. `$actualVersion` given",
    [SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_NOT_SUPPORTED]: "This version of Kit does not support decoding transactions with version $unsupportedVersion. The current max supported version is 1.",
    [SOLANA_ERROR__TRANSACTION__NONCE_ACCOUNT_CANNOT_BE_IN_LOOKUP_TABLE]: "The transaction has a durable nonce lifetime (with nonce `$nonce`), but the nonce account address is in a lookup table. The lifetime constraint cannot be constructed without fetching the lookup tables for the transaction.",
    [SOLANA_ERROR__TRANSACTION__INVALID_CONFIG_MASK_PRIORITY_FEE_BITS]: "Invalid transaction config mask: $mask. Bits 0 and 1 must match (both set or both unset)",
    [SOLANA_ERROR__TRANSACTION__MALFORMED_MESSAGE_BYTES]: "Transaction message bytes are malformed: $messageBytes",
    [SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_MESSAGE_BYTES]: "Transaction message bytes are empty, so the transaction cannot be encoded",
    [SOLANA_ERROR__TRANSACTION__CANNOT_DECODE_EMPTY_TRANSACTION_BYTES]: "Transaction bytes are empty, so no transaction can be decoded",
    [SOLANA_ERROR__TRANSACTION__VERSION_ZERO_MUST_BE_ENCODED_WITH_SIGNATURES_FIRST]: "Transaction version 0 must be encoded with signatures first. This transaction was encoded with first byte $firstByte, which is expected to be a signature count for v0 transactions.",
    [SOLANA_ERROR__TRANSACTION__SIGNATURE_COUNT_TOO_HIGH_FOR_TRANSACTION_BYTES]: "The provided transaction bytes expect that there should be $numExpectedSignatures signatures, but the bytes are not long enough to contain a transaction message with this many signatures. The provided bytes are $transactionBytesLength bytes long.",
    [SOLANA_ERROR__TRANSACTION__INVALID_NONCE_ACCOUNT_INDEX]: "The transaction has a durable nonce lifetime, but the nonce account index is invalid. Expected a nonce account index less than $numberOfStaticAccounts, got $nonceAccountIndex.",
    [SOLANA_ERROR__TRANSACTION__INVALID_CONFIG_VALUE_KIND]: "The transaction config value for $configName has the incorrect kind. Expected $expectedKind, got $actualKind.",
    [SOLANA_ERROR__TRANSACTION__INSTRUCTION_HEADERS_PAYLOADS_MISMATCH]: "The transaction does not have the same number of instruction headers and instruction payloads. Got $numInstructionHeaders instruction headers, and $numInstructionPayloads instruction payloads.",
    [SOLANA_ERROR__TRANSACTION__TOO_MANY_SIGNER_ADDRESSES]: "Transaction has $actualCount unique signer addresses but the maximum allowed is $maxAllowed",
    [SOLANA_ERROR__TRANSACTION__TOO_MANY_ACCOUNT_ADDRESSES]: "Transaction has $actualCount unique account addresses but the maximum allowed is $maxAllowed",
    [SOLANA_ERROR__TRANSACTION__TOO_MANY_INSTRUCTIONS]: "Transaction has $actualCount instructions but the maximum allowed is $maxAllowed",
    [SOLANA_ERROR__TRANSACTION__TOO_MANY_ACCOUNTS_IN_INSTRUCTION]: "The instruction at index $instructionIndex has $actualCount account references but the maximum allowed is $maxAllowed",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_ACCOUNT_INDEX_OUT_OF_RANGE]: "Could not find an account address at index $index while decompiling an instruction",
    [SOLANA_ERROR__TRANSACTION_INTROSPECTION__CANNOT_DECODE_JSON_PARSED_TRANSACTION]: "`getTransaction` responses fetched with `encoding: 'jsonParsed'` cannot be decoded. Re-fetch the transaction with `encoding: 'base64'`, `'base58'`, or `'json'`",
    [SOLANA_ERROR__TRANSACTION_INTROSPECTION__UNRECOGNIZED_GET_TRANSACTION_RESPONSE]: "Could not recognize the shape of this `getTransaction` response. Expected a response fetched with `encoding: 'base64'`, `'base58'`, or `'json'`",
    [SOLANA_ERROR__REACT__MISSING_CAPABILITY]: "`$hookName` requires the following capabilities to be installed on the client: [$capabilities]. $providerHint",
    [SOLANA_ERROR__REACT__MISSING_PROVIDER]: "`$hookName` was called outside of a `ClientProvider`. Mount a `<ClientProvider client={client}>` in the ancestor tree.",
    [SOLANA_ERROR__REACT__SUBSCRIPTION_CLOSED_WITHOUT_ERROR]: "The subscription closed in an error state but did not report an error.",
    [SOLANA_ERROR__WALLET__NOT_CONNECTED]: "Cannot $operation: no wallet connected",
    [SOLANA_ERROR__WALLET__NO_SIGNER_CONNECTED]: "No signing wallet connected (status: $status)",
    [SOLANA_ERROR__WALLET__SIGNER_NOT_AVAILABLE]: "Connected wallet does not support signing",
    [SOLANA_ERROR__WALLET__ACCOUNT_NOT_AVAILABLE]: 'Account $address is not available in wallet "$walletName"'
  };
  var INSTRUCTION_ERROR_RANGE_SIZE = 1e3;
  var START_INDEX = "i";
  var TYPE = "t";
  function getHumanReadableErrorMessage(code, context = {}) {
    const messageFormatString = SolanaErrorMessages[code];
    if (messageFormatString.length === 0) {
      return "";
    }
    let state;
    function commitStateUpTo(endIndex) {
      if (state[TYPE] === 2) {
        const variableName = messageFormatString.slice(state[START_INDEX] + 1, endIndex);
        fragments.push(
          variableName in context ? (
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `${context[variableName]}`
          ) : `$${variableName}`
        );
      } else if (state[TYPE] === 1) {
        fragments.push(messageFormatString.slice(state[START_INDEX], endIndex));
      }
    }
    const fragments = [];
    messageFormatString.split("").forEach((char, ii) => {
      if (ii === 0) {
        state = {
          [START_INDEX]: 0,
          [TYPE]: messageFormatString[0] === "\\" ? 0 : messageFormatString[0] === "$" ? 2 : 1
          /* Text */
        };
        return;
      }
      let nextState;
      switch (state[TYPE]) {
        case 0:
          nextState = {
            [START_INDEX]: ii,
            [TYPE]: 1
            /* Text */
          };
          break;
        case 1:
          if (char === "\\") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 0
              /* EscapeSequence */
            };
          } else if (char === "$") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 2
              /* Variable */
            };
          }
          break;
        case 2:
          if (char === "\\") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 0
              /* EscapeSequence */
            };
          } else if (char === "$") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 2
              /* Variable */
            };
          } else if (!char.match(/\w/)) {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 1
              /* Text */
            };
          }
          break;
      }
      if (nextState) {
        if (state !== nextState) {
          commitStateUpTo(ii);
        }
        state = nextState;
      }
    });
    commitStateUpTo();
    let message = fragments.join("");
    if (code >= SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN && code < SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN + INSTRUCTION_ERROR_RANGE_SIZE && "index" in context) {
      message += ` (instruction #${context.index + 1})`;
    }
    return message;
  }
  function getErrorMessage(code, context = {}) {
    if (true) {
      return getHumanReadableErrorMessage(code, context);
    } else {
      let decodingAdviceMessage = `Solana error #${code}; Decode this error by running \`npx @solana/errors decode -- ${code}`;
      if (Object.keys(context).length) {
        decodingAdviceMessage += ` '${encodeContextObject(context)}'`;
      }
      return `${decodingAdviceMessage}\``;
    }
  }
  var SolanaError = class extends Error {
    constructor(...[code, contextAndErrorOptions]) {
      let context;
      let errorOptions;
      if (contextAndErrorOptions) {
        Object.entries(Object.getOwnPropertyDescriptors(contextAndErrorOptions)).forEach(([name, descriptor]) => {
          if (name === "cause") {
            errorOptions = { cause: descriptor.value };
          } else {
            if (context === void 0) {
              context = {
                __code: code
              };
            }
            Object.defineProperty(context, name, descriptor);
          }
        });
      }
      const message = getErrorMessage(code, context);
      super(message, errorOptions);
      /**
       * Indicates the root cause of this {@link SolanaError}, if any.
       *
       * For example, a transaction error might have an instruction error as its root cause. In this
       * case, you will be able to access the instruction error on the transaction error as `cause`.
       */
      __publicField(this, "cause", this.cause);
      /**
       * Contains context that can assist in understanding or recovering from a {@link SolanaError}.
       */
      __publicField(this, "context");
      this.context = Object.freeze(
        context === void 0 ? {
          __code: code
        } : context
      );
      this.name = "SolanaError";
    }
  };

  // node_modules/@solana/codecs-core/dist/index.browser.mjs
  function getEncodedSize(value, encoder) {
    return "fixedSize" in encoder ? encoder.fixedSize : encoder.getSizeFromValue(value);
  }
  function createEncoder(encoder) {
    return Object.freeze({
      ...encoder,
      encode: (value) => {
        const bytes = new Uint8Array(getEncodedSize(value, encoder));
        encoder.write(value, bytes, 0);
        return bytes;
      }
    });
  }
  function createDecoder(decoder) {
    return Object.freeze({
      ...decoder,
      decode: (bytes, offset = 0) => decoder.read(bytes, offset)[0]
    });
  }

  // node_modules/@solana/codecs-strings/dist/index.browser.mjs
  function assertValidBaseString(alphabet4, testValue, givenValue = testValue) {
    if (!testValue.match(new RegExp(`^[${alphabet4}]*$`))) {
      throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
        alphabet: alphabet4,
        base: alphabet4.length,
        value: givenValue
      });
    }
  }
  var getBaseXEncoder = (alphabet4) => {
    return createEncoder({
      getSizeFromValue: (value) => {
        const [leadingZeroes, tailChars] = partitionLeadingZeroes(value, alphabet4[0]);
        if (!tailChars) return value.length;
        const base10Number = getBigIntFromBaseX(tailChars, alphabet4);
        return leadingZeroes.length + Math.ceil(base10Number.toString(16).length / 2);
      },
      write(value, bytes, offset) {
        assertValidBaseString(alphabet4, value);
        if (value === "") return offset;
        const [leadingZeroes, tailChars] = partitionLeadingZeroes(value, alphabet4[0]);
        if (!tailChars) {
          bytes.set(new Uint8Array(leadingZeroes.length).fill(0), offset);
          return offset + leadingZeroes.length;
        }
        let base10Number = getBigIntFromBaseX(tailChars, alphabet4);
        const tailBytes = [];
        while (base10Number > 0n) {
          tailBytes.unshift(Number(base10Number % 256n));
          base10Number /= 256n;
        }
        const bytesToAdd = [...Array(leadingZeroes.length).fill(0), ...tailBytes];
        bytes.set(bytesToAdd, offset);
        return offset + bytesToAdd.length;
      }
    });
  };
  var getBaseXDecoder = (alphabet4) => {
    return createDecoder({
      read(rawBytes, offset) {
        const bytes = offset === 0 || offset <= -rawBytes.byteLength ? rawBytes : rawBytes.slice(offset);
        if (bytes.length === 0) return ["", rawBytes.length];
        let trailIndex = bytes.findIndex((n) => n !== 0);
        trailIndex = trailIndex === -1 ? bytes.length : trailIndex;
        const leadingZeroes = alphabet4[0].repeat(trailIndex);
        if (trailIndex === bytes.length) return [leadingZeroes, rawBytes.length];
        const base10Number = bytes.slice(trailIndex).reduce((sum, byte) => sum * 256n + BigInt(byte), 0n);
        const tailChars = getBaseXFromBigInt(base10Number, alphabet4);
        return [leadingZeroes + tailChars, rawBytes.length];
      }
    });
  };
  function partitionLeadingZeroes(value, zeroCharacter) {
    const [leadingZeros, tailChars] = value.split(new RegExp(`((?!${zeroCharacter}).*)`));
    return [leadingZeros, tailChars];
  }
  function getBigIntFromBaseX(value, alphabet4) {
    const base = BigInt(alphabet4.length);
    let sum = 0n;
    for (const char of value) {
      sum *= base;
      sum += BigInt(alphabet4.indexOf(char));
    }
    return sum;
  }
  function getBaseXFromBigInt(value, alphabet4) {
    const base = BigInt(alphabet4.length);
    const tailChars = [];
    while (value > 0n) {
      tailChars.unshift(alphabet4[Number(value % base)]);
      value /= base;
    }
    return tailChars.join("");
  }
  var alphabet2 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var getBase58Encoder = () => getBaseXEncoder(alphabet2);
  var getBase58Decoder = () => getBaseXDecoder(alphabet2);
  var alphabet3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var getBase64Encoder = () => {
    {
      return createEncoder({
        getSizeFromValue: (value) => {
          try {
            return atob(value).length;
          } catch {
            throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
              alphabet: alphabet3,
              base: 64,
              value
            });
          }
        },
        write(value, bytes, offset) {
          try {
            const bytesToAdd = atob(value).split("").map((c) => c.charCodeAt(0));
            bytes.set(bytesToAdd, offset);
            return bytesToAdd.length + offset;
          } catch {
            throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
              alphabet: alphabet3,
              base: 64,
              value
            });
          }
        }
      });
    }
  };
  var getBase64Decoder = () => {
    {
      return createDecoder({
        read(bytes, offset = 0) {
          const slice = bytes.slice(offset);
          const value = btoa(String.fromCharCode(...slice));
          return [value, bytes.length];
        }
      });
    }
  };
  var removeNullCharacters = (value) => (
    // eslint-disable-next-line no-control-regex
    value.replace(/\u0000/g, "")
  );
  var e = globalThis.TextDecoder;
  var o = globalThis.TextEncoder;
  var getUtf8Encoder = () => {
    let textEncoder;
    return createEncoder({
      getSizeFromValue: (value) => (textEncoder || (textEncoder = new o())).encode(value).length,
      write: (value, bytes, offset) => {
        const bytesToAdd = (textEncoder || (textEncoder = new o())).encode(value);
        bytes.set(bytesToAdd, offset);
        return offset + bytesToAdd.length;
      }
    });
  };
  var getUtf8Decoder = () => {
    let textDecoder;
    return createDecoder({
      read(bytes, offset) {
        const value = (textDecoder || (textDecoder = new e())).decode(bytes.slice(offset));
        return [removeNullCharacters(value), bytes.length];
      }
    });
  };

  // node_modules/@solana-mobile/mobile-wallet-adapter-protocol/lib/esm/chunks/encoding.js
  function encode(input) {
    return getBase64Decoder().decode(getUtf8Encoder().encode(input));
  }
  function fromUint8Array$1(byteArray, urlsafe) {
    const base64 = getBase64Decoder().decode(byteArray);
    if (urlsafe) return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    else return base64;
  }
  function toUint8Array$1(base64EncodedByteArray) {
    return getBase64Encoder().encode(base64EncodedByteArray);
  }
  function fromUint8Array(byteArray) {
    return getBase58Decoder().decode(byteArray);
  }
  function toUint8Array(base58EncodedByteArray) {
    return getBase58Encoder().encode(base58EncodedByteArray);
  }
  function base64ToBase58$1(base64EncodedString) {
    return fromUint8Array(toUint8Array$1(base64EncodedString));
  }
  function arrayBufferToBase64String(buffer) {
    return fromUint8Array$1(new Uint8Array(buffer));
  }
  function base58FromUint8Array(byteArray) {
    return fromUint8Array(byteArray);
  }
  function base58ToUint8Array(base58EncodedByteArray) {
    return toUint8Array(base58EncodedByteArray);
  }
  function base64FromUint8Array(byteArray) {
    return fromUint8Array$1(byteArray);
  }
  function base64ToUint8Array(base64EncodedByteArray) {
    return toUint8Array$1(base64EncodedByteArray);
  }
  function utf8FromUint8Array(byteArray) {
    return getUtf8Decoder().decode(byteArray);
  }
  function utf8ToUint8Array(input) {
    return getUtf8Encoder().encode(input);
  }

  // node_modules/@solana/wallet-standard-chains/lib/esm/index.js
  var SOLANA_MAINNET_CHAIN = "solana:mainnet";

  // node_modules/@wallet-standard/wallet/lib/esm/register.js
  var __classPrivateFieldGet = function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  };
  var __classPrivateFieldSet = function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  };
  var _RegisterWalletEvent_detail;
  function registerWallet(wallet) {
    const callback = ({ register }) => register(wallet);
    try {
      window.dispatchEvent(new RegisterWalletEvent(callback));
    } catch (error) {
      console.error("wallet-standard:register-wallet event could not be dispatched\n", error);
    }
    try {
      window.addEventListener("wallet-standard:app-ready", ({ detail: api }) => callback(api));
    } catch (error) {
      console.error("wallet-standard:app-ready event listener could not be added\n", error);
    }
  }
  var RegisterWalletEvent = class extends Event {
    get detail() {
      return __classPrivateFieldGet(this, _RegisterWalletEvent_detail, "f");
    }
    get type() {
      return "wallet-standard:register-wallet";
    }
    constructor(callback) {
      super("wallet-standard:register-wallet", {
        bubbles: false,
        cancelable: false,
        composed: false
      });
      _RegisterWalletEvent_detail.set(this, void 0);
      __classPrivateFieldSet(this, _RegisterWalletEvent_detail, callback, "f");
    }
    /** @deprecated */
    preventDefault() {
      throw new Error("preventDefault cannot be called");
    }
    /** @deprecated */
    stopImmediatePropagation() {
      throw new Error("stopImmediatePropagation cannot be called");
    }
    /** @deprecated */
    stopPropagation() {
      throw new Error("stopPropagation cannot be called");
    }
  };
  _RegisterWalletEvent_detail = /* @__PURE__ */ new WeakMap();

  // node_modules/@noble/hashes/_u64.js
  var fromNumH = (n) => n / 2 ** 32 | 0;
  var fromNumL = (n) => n >>> 0;
  function setU64FromNum(view, byteOffset, n, isLE) {
    const h = fromNumH(n);
    const l = fromNumL(n);
    view.setUint32(byteOffset, isLE ? l : h, isLE);
    view.setUint32(byteOffset + 4, isLE ? h : l, isLE);
  }

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle = (title) => title ? `"${title}" ` : "";
  function anumber(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abytes(value, length, title = "") {
    if (isBytes(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber(length, "length");
    const bytes = isBytes(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  var aobject = (value, label) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
  };
  var aopts = (value, label) => {
    aobject(value, label);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
      throw new TypeError(`"${label}" expected plain object`);
    if (Object.hasOwn(value, "__proto__"))
      throw new TypeError(`"${label}.__proto__" is not allowed`);
  };
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  var hasHexBuiltin = /* @__PURE__ */ (() => (
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
  ))();
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  function asciiToBase16(ch) {
    return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    if (hasHexBuiltin) {
      try {
        return Uint8Array.fromHex(hex);
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new RangeError(error.message);
        throw error;
      }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new RangeError("hex string expected, got unpadded hex of length " + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2;
    }
    return array;
  }
  function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
      const a = arrays[i];
      abytes(a);
      sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
      const a = arrays[i];
      res.set(a, pad);
      pad += a.length;
    }
    return res;
  }
  function checkOpts(defaults, opts, title = "opts") {
    aopts(defaults, "defaults");
    if (opts !== void 0)
      aopts(opts, title);
    const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== "function")
      throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, "info");
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  function randomBytes(bytesLength = 32) {
    anumber(bytesLength, "bytesLength");
    const cr = typeof globalThis === "object" ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== "function")
      throw new Error("crypto.getRandomValues must be defined");
    if (bytesLength > 65536)
      throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    constructor(blockLen, outputLen, padOffset, isLE) {
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "canXOF", false);
      __publicField(this, "padOffset");
      __publicField(this, "isLE");
      // For partial updates less than block size
      __publicField(this, "buffer");
      __publicField(this, "view");
      __publicField(this, "finished", false);
      __publicField(this, "length", 0);
      __publicField(this, "pos", 0);
      __publicField(this, "destroyed", false);
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      let processed = false;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          processed = true;
          continue;
        }
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
          processed = true;
        }
      }
      this.length += data.length;
      if (processed)
        this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      buffer.fill(0, pos);
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        buffer.fill(0);
      }
      setU64FromNum(view, blockLen - 8, this.length * 8, isLE);
      this.process(view, 0);
      this.roundClean();
      const oview = out === buffer ? view : createView(out);
      const len = this.outputLen;
      const outLen = len / 4;
      const state = this.get();
      if (len % 4 || outLen > state.length)
        throw new Error("invalid outputLen");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneIntoMeta(to) {
      const { buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (pos)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);

  // node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    constructor(outputLen, IV) {
      super(64, outputLen, 8, false);
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      // Numeric initializers matter: starting the fields as `undefined` changes
      // V8's field representation and makes sha256 3x slower (measured).
      __publicField(this, "A", 0);
      __publicField(this, "B", 0);
      __publicField(this, "C", 0);
      __publicField(this, "D", 0);
      __publicField(this, "E", 0);
      __publicField(this, "F", 0);
      __publicField(this, "G", 0);
      __publicField(this, "H", 0);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    _cloneInto(to) {
      (to || (to = new this.constructor())).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    constructor() {
      super(32, SHA256_IV);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );

  // node_modules/@noble/curves/utils.js
  function aarray(item, title, inner = () => {
  }) {
    if (!Array.isArray(item))
      throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
    for (let i = 0; i < item.length; i++)
      inner(item[i], `${title}[${i}]`);
    return item;
  }
  var abytes2 = (value, length, title) => abytes(value, length, title);
  var anumber2 = anumber;
  function aobject2(value, title = "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
    return value;
  }
  function afunction(value, title) {
    if (typeof value !== "function")
      throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
    return value;
  }
  var bytesToHex2 = bytesToHex;
  var concatBytes2 = (...arrays) => concatBytes(...arrays);
  var hexToBytes2 = (hex) => hexToBytes(hex);
  var isBytes2 = isBytes;
  var randomBytes2 = (bytesLength) => randomBytes(bytesLength);
  var _0n = /* @__PURE__ */ BigInt(0);
  var _1n = /* @__PURE__ */ BigInt(1);
  var atitle2 = (title) => title ? `"${title}" ` : "";
  function abool(value, title = "") {
    if (typeof value !== "boolean")
      throw new TypeError(atitle2(title) + "expected boolean, got type=" + typeof value);
    return value;
  }
  function abignumber(n) {
    if (typeof n === "bigint") {
      if (!isPosBig(n))
        throw new RangeError("positive bigint expected, got " + n);
    } else
      anumber2(n);
    return n;
  }
  function asafenumber(value, title = "") {
    if (typeof value !== "number") {
      const prefix = title && `"${title}" `;
      throw new TypeError(prefix + "expected number, got type=" + typeof value);
    }
    if (!Number.isSafeInteger(value)) {
      const prefix = title && `"${title}" `;
      throw new RangeError(prefix + "expected safe integer, got " + value);
    }
  }
  function hexToNumber(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    return hex === "" ? _0n : BigInt("0x" + hex);
  }
  function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
  }
  function bytesToNumberLE(bytes) {
    return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
  }
  function numberToBytesBE(n, len) {
    anumber(len);
    if (len === 0)
      throw new Error("zero output length is invalid");
    n = abignumber(n);
    const expectedLen = len * 2;
    const hex = n.toString(16);
    if (hex.length > expectedLen)
      throw new RangeError("number is too large");
    return hexToBytes(hex.padStart(expectedLen, "0"));
  }
  function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
  }
  function copyBytes(bytes) {
    return Uint8Array.from(abytes2(bytes));
  }
  function asciiToBytes(ascii) {
    if (typeof ascii !== "string")
      throw new TypeError("ascii string expected, got " + typeof ascii);
    return Uint8Array.from(ascii, (c, i) => {
      const charCode = c.charCodeAt(0);
      if (c.length !== 1 || charCode > 127) {
        throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
      }
      return charCode;
    });
  }
  function isPosBig(n) {
    return typeof n === "bigint" && _0n <= n;
  }
  function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
  }
  function aInRange(title, n, min, max) {
    if (!inRange(n, min, max))
      throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
  }
  function bitLen(n) {
    if (n < _0n)
      throw new Error("expected non-negative bigint, got " + n);
    return n === _0n ? 0 : n.toString(2).length;
  }
  var bitMask = (n) => {
    asafenumber(n, "n");
    return (_1n << BigInt(n)) - _1n;
  };
  function validateObject(object, fields = {}, optFields = {}, title = "object") {
    aobject2(object, title);
    aobject2(fields, "fields");
    aobject2(optFields, "optFields");
    function checkField(fieldName, expectedType, isOpt) {
      const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
      const val = object[fieldName];
      if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== void 0 : expectedType !== "function")) {
        throw new TypeError(`${label} is invalid: expected own property`);
      }
      if (isOpt && val === void 0)
        return;
      const current = typeof val;
      if (current !== expectedType || val === null)
        throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
    }
    const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
    iter(fields, false);
    iter(optFields, true);
  }

  // node_modules/@noble/curves/abstract/modular.js
  var _0n2 = /* @__PURE__ */ BigInt(0);
  var _1n2 = /* @__PURE__ */ BigInt(1);
  var _2n = /* @__PURE__ */ BigInt(2);
  var _3n = /* @__PURE__ */ BigInt(3);
  var _4n = /* @__PURE__ */ BigInt(4);
  var _5n = /* @__PURE__ */ BigInt(5);
  var _7n = /* @__PURE__ */ BigInt(7);
  var _8n = /* @__PURE__ */ BigInt(8);
  var _9n = /* @__PURE__ */ BigInt(9);
  var _15n = /* @__PURE__ */ BigInt(15);
  var _16n = /* @__PURE__ */ BigInt(16);
  var POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
  function mod(a, b) {
    if (b <= _0n2)
      throw new Error("mod: expected positive modulus, got " + b);
    const result = a % b;
    return result >= _0n2 ? result : b + result;
  }
  function pow(num2, power, modulo) {
    if (modulo <= _1n2)
      throw new Error("pow: expected modulus > 1, got " + modulo);
    if (typeof power !== "bigint")
      throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
    if (power < _0n2)
      throw new Error("invalid exponent, negatives unsupported");
    if (power === _0n2)
      return _1n2;
    if (power === _1n2)
      return num2;
    let d = num2 % modulo;
    if (d < _0n2)
      d += modulo;
    if (power < POW_WINDOWED_MIN) {
      let p2 = _1n2;
      while (power > _0n2) {
        if (power & _1n2)
          p2 = p2 * d % modulo;
        d = d * d % modulo;
        power >>= _1n2;
      }
      return p2;
    }
    const digits = [];
    while (power > _0n2) {
      digits.push(Number(power & _15n));
      power >>= _4n;
    }
    const table = new Array(16);
    table[0] = _1n2;
    table[1] = d;
    for (let i = 2; i < 16; i++)
      table[i] = table[i - 1] * d % modulo;
    let p = table[digits[digits.length - 1]];
    for (let w = digits.length - 2; w >= 0; w--) {
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      const digit = digits[w];
      if (digit !== 0)
        p = p * table[digit] % modulo;
    }
    return p;
  }
  function pow2(x, power, modulo) {
    if (modulo <= _1n2)
      throw new Error("pow2: expected modulus > 1, got " + modulo);
    if (power < _0n2)
      throw new Error("pow2: expected non-negative exponent, got " + power);
    let res = x;
    while (power-- > _0n2) {
      res *= res;
      res %= modulo;
    }
    return res;
  }
  function invert(number, modulo) {
    if (number === _0n2)
      throw new Error("invert: expected non-zero number");
    if (modulo <= _1n2)
      throw new Error("invert: expected modulus > 1, got " + modulo);
    let a = mod(number, modulo);
    let b = modulo;
    let x = _0n2, u = _1n2;
    while (a !== _0n2) {
      const q = b / a;
      const r = b - a * q;
      const m = x - u * q;
      b = a, a = r, x = u, u = m;
    }
    const gcd = b;
    if (gcd !== _1n2)
      throw new Error("invert: does not exist");
    return mod(x, modulo);
  }
  function assertIsSquare(Fp, root, n) {
    const F = Fp;
    if (!F.eql(F.sqr(root), n))
      throw new Error("Cannot find square root");
  }
  function aoddModulus(order, fnName) {
    if ((order & _1n2) === _0n2)
      throw new Error(fnName + ": expected odd modulus, got " + order);
  }
  function sqrt3mod4(Fp, n) {
    const F = Fp;
    const p1div4 = (F.ORDER + _1n2) / _4n;
    const root = F.pow(n, p1div4);
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt5mod8(Fp, n) {
    const F = Fp;
    const p5div8 = (F.ORDER - _5n) / _8n;
    const n2 = F.mul(n, _2n);
    const v = F.pow(n2, p5div8);
    const nv = F.mul(n, v);
    const i = F.mul(F.mul(nv, _2n), v);
    const root = F.mul(nv, F.sub(i, F.ONE));
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
    const c2 = tn(Fp_, c1);
    const c3 = tn(Fp_, Fp_.neg(c1));
    const c4 = (P + _7n) / _16n;
    return ((Fp, n) => {
      const F = Fp;
      let tv1 = F.pow(n, c4);
      let tv2 = F.mul(tv1, c1);
      const tv3 = F.mul(tv1, c2);
      const tv4 = F.mul(tv1, c3);
      const e1 = F.eql(F.sqr(tv2), n);
      const e2 = F.eql(F.sqr(tv3), n);
      tv1 = F.cmov(tv1, tv2, e1);
      tv2 = F.cmov(tv4, tv3, e2);
      const e3 = F.eql(F.sqr(tv2), n);
      const root = F.cmov(tv1, tv2, e3);
      assertIsSquare(F, root, n);
      return root;
    });
  }
  function tonelliShanks(P) {
    if (P < _3n)
      throw new Error("sqrt is not defined for small field");
    aoddModulus(P, "tonelliShanks");
    let Q = P - _1n2;
    let S = 0;
    while (Q % _2n === _0n2) {
      Q /= _2n;
      S++;
    }
    let Z = _2n;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z) === 1) {
      if (Z++ > 1e3)
        throw new Error("Cannot find square root: probably non-prime P");
    }
    if (S === 1)
      return sqrt3mod4;
    let cc = _Fp.pow(Z, Q);
    const Q1div2 = (Q + _1n2) / _2n;
    return function tonelliSlow(Fp, n) {
      const F = Fp;
      if (F.is0(n))
        return n;
      if (FpLegendre(F, n) !== 1)
        throw new Error("Cannot find square root");
      let M = S;
      let c = F.mul(F.ONE, cc);
      let t = F.pow(n, Q);
      let R = F.pow(n, Q1div2);
      while (!F.eql(t, F.ONE)) {
        if (F.is0(t))
          throw new Error("Cannot find square root: probably non-prime P");
        let i = 1;
        let t_tmp = F.sqr(t);
        while (!F.eql(t_tmp, F.ONE)) {
          i++;
          t_tmp = F.sqr(t_tmp);
          if (i === M)
            throw new Error("Cannot find square root");
        }
        const exponent = _1n2 << BigInt(M - i - 1);
        const b = F.pow(c, exponent);
        M = i;
        c = F.sqr(b);
        t = F.mul(t, c);
        R = F.mul(R, b);
      }
      return R;
    };
  }
  function FpSqrt(P) {
    aoddModulus(P, "Fp.sqrt");
    if (P % _4n === _3n)
      return sqrt3mod4;
    if (P % _8n === _5n)
      return sqrt5mod8;
    if (P % _16n === _9n)
      return sqrt9mod16(P);
    return tonelliShanks(P);
  }
  var FIELD_FIELDS = [
    "create",
    "isValid",
    "is0",
    "neg",
    "inv",
    "sqrt",
    "sqr",
    "eql",
    "add",
    "sub",
    "mul",
    "pow",
    "div",
    "addN",
    "subN",
    "mulN",
    "sqrN"
  ];
  function validateField(field) {
    aobject2(field, "field");
    if (typeof field.ORDER !== "bigint")
      throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
    asafenumber(field.BYTES, "BYTES");
    asafenumber(field.BITS, "BITS");
    for (const name of FIELD_FIELDS)
      afunction(field[name], "field." + name);
    if (field.BYTES < 1 || field.BITS < 1)
      throw new Error("invalid field: expected BYTES/BITS > 0");
    if (field.ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
    return field;
  }
  function FpInvertBatch(Fp, nums, passZero = false) {
    validateField(Fp);
    aarray(nums, "nums");
    abool(passZero, "passZero");
    const F = Fp;
    const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
    const multipliedAcc = nums.reduce((acc, num2, i) => {
      if (F.is0(num2))
        return acc;
      inverted[i] = acc;
      return F.mul(acc, num2);
    }, F.ONE);
    const invertedAcc = F.inv(multipliedAcc);
    nums.reduceRight((acc, num2, i) => {
      if (F.is0(num2))
        return acc;
      inverted[i] = F.mul(acc, inverted[i]);
      return F.mul(acc, num2);
    }, invertedAcc);
    return inverted;
  }
  function FpLegendre(Fp, n) {
    validateField(Fp);
    const F = Fp;
    aoddModulus(F.ORDER, "FpLegendre");
    const p1mod2 = (F.ORDER - _1n2) / _2n;
    const powered = F.pow(n, p1mod2);
    const yes = F.eql(powered, F.ONE);
    const zero = F.eql(powered, F.ZERO);
    const no = F.eql(powered, F.neg(F.ONE));
    if (!yes && !zero && !no)
      throw new Error("invalid Legendre symbol result");
    return yes ? 1 : zero ? 0 : -1;
  }
  function nLength(n, nBitLength) {
    if (nBitLength !== void 0)
      anumber2(nBitLength);
    if (n <= _0n2)
      throw new Error("invalid n length: expected positive n, got " + n);
    if (nBitLength !== void 0 && nBitLength < 1)
      throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
    const bits = bitLen(n);
    if (nBitLength !== void 0 && nBitLength < bits)
      throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
    const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
  }
  var FIELD_SQRT = /* @__PURE__ */ new WeakMap();
  var _Field = class {
    constructor(ORDER, opts = {}) {
      __publicField(this, "ORDER");
      __publicField(this, "BITS");
      __publicField(this, "BYTES");
      __publicField(this, "isLE");
      __publicField(this, "ZERO", _0n2);
      __publicField(this, "ONE", _1n2);
      __publicField(this, "_lengths");
      __publicField(this, "_mod");
      if (ORDER <= _1n2)
        throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
      let _nbitLength = void 0;
      this.isLE = false;
      if (opts != null && typeof opts === "object") {
        if (typeof opts.BITS === "number")
          _nbitLength = opts.BITS;
        if (typeof opts.sqrt === "function")
          Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
        if (typeof opts.isLE === "boolean")
          this.isLE = opts.isLE;
        if (opts.allowedLengths)
          this._lengths = Object.freeze(opts.allowedLengths.slice());
        if (typeof opts.modFromBytes === "boolean")
          this._mod = opts.modFromBytes;
      }
      const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
      if (nByteLength > 2048)
        throw new Error("invalid field: expected ORDER of <= 2048 bytes");
      this.ORDER = ORDER;
      this.BITS = nBitLength;
      this.BYTES = nByteLength;
      Object.freeze(this);
    }
    create(num2) {
      return mod(num2, this.ORDER);
    }
    isValid(num2) {
      if (typeof num2 !== "bigint")
        throw new TypeError("invalid field element: expected bigint, got " + typeof num2);
      return _0n2 <= num2 && num2 < this.ORDER;
    }
    is0(num2) {
      return num2 === _0n2;
    }
    // is valid and invertible
    isValidNot0(num2) {
      return !this.is0(num2) && this.isValid(num2);
    }
    isOdd(num2) {
      return (num2 & _1n2) === _1n2;
    }
    neg(num2) {
      return mod(-num2, this.ORDER);
    }
    eql(lhs, rhs) {
      return lhs === rhs;
    }
    sqr(num2) {
      return mod(num2 * num2, this.ORDER);
    }
    add(lhs, rhs) {
      return mod(lhs + rhs, this.ORDER);
    }
    sub(lhs, rhs) {
      return mod(lhs - rhs, this.ORDER);
    }
    mul(lhs, rhs) {
      return mod(lhs * rhs, this.ORDER);
    }
    pow(num2, power) {
      return pow(num2, power, this.ORDER);
    }
    div(lhs, rhs) {
      return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
    }
    // Same as above, but doesn't normalize
    sqrN(num2) {
      return num2 * num2;
    }
    addN(lhs, rhs) {
      return lhs + rhs;
    }
    subN(lhs, rhs) {
      return lhs - rhs;
    }
    mulN(lhs, rhs) {
      return lhs * rhs;
    }
    inv(num2) {
      return invert(num2, this.ORDER);
    }
    sqrt(num2) {
      let sqrt = FIELD_SQRT.get(this);
      if (!sqrt)
        FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
      return sqrt(this, num2);
    }
    toBytes(num2) {
      return this.isLE ? numberToBytesLE(num2, this.BYTES) : numberToBytesBE(num2, this.BYTES);
    }
    fromBytes(bytes, skipValidation = false) {
      abytes2(bytes);
      const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
      if (allowedLengths) {
        if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!this.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    }
    // TODO: we don't need it here, move out to separate fn
    invertBatch(lst) {
      return FpInvertBatch(this, lst, true);
    }
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov(a, b, condition) {
      abool(condition, "condition");
      return condition ? b : a;
    }
  };
  function Field(ORDER, opts = {}) {
    Object.freeze(_Field.prototype);
    return new _Field(ORDER, opts);
  }
  function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== "bigint")
      throw new Error("field order must be bigint");
    if (fieldOrder <= _1n2)
      throw new Error("field order must be greater than 1");
    const bitLength = bitLen(fieldOrder - _1n2);
    return Math.ceil(bitLength / 8);
  }
  function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
  }
  function mapHashToField(key, fieldOrder, isLE = false) {
    abytes2(key);
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = Math.max(getMinHashLength(fieldOrder), 16);
    if (len < minLen || len > 1024)
      throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
    const num2 = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
    const reduced = mod(num2, fieldOrder - _1n2) + _1n2;
    return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
  }

  // node_modules/@noble/curves/abstract/curve.js
  var _0n3 = /* @__PURE__ */ BigInt(0);
  var _1n3 = /* @__PURE__ */ BigInt(1);
  var _4n2 = /* @__PURE__ */ BigInt(4);
  var BLIND_BYTES = 16;
  var BLIND_BITS = 128;
  var FW_WINDOW = 5;
  var TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
  function validatePointCons(Point) {
    const pc = Point;
    if (typeof pc !== "function")
      throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
    afunction(pc.fromAffine, "Point.fromAffine");
    afunction(pc.fromBytes, "Point.fromBytes");
    afunction(pc.fromHex, "Point.fromHex");
    aobject2(pc.BASE, "Point.BASE");
    aobject2(pc.ZERO, "Point.ZERO");
    validateField(pc.Fp);
    validateField(pc.Fn);
  }
  function normalizeZ(c, points) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
    return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
  }
  function validateW(W, bits, min = 1) {
    if (!Number.isSafeInteger(W) || W < min || W > bits)
      throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
  }
  function validateTableBytes(numPoints, fpBytes) {
    const bytes = numPoints * (4 * fpBytes + 128);
    if (bytes > TABLE_BYTES_MAX)
      throw new Error("invalid window size: table would need ~" + Math.ceil(bytes / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
  }
  function probeRandomBytes(randomBytes3, length) {
    if (randomBytes3 === void 0)
      return void 0;
    afunction(randomBytes3, "randomBytes");
    try {
      const probe = randomBytes3(length);
      if (!isBytes2(probe) || probe.length !== length)
        return void 0;
    } catch {
      return void 0;
    }
    return randomBytes3;
  }
  function validateMSMPoints(points, c) {
    aarray(points, "points");
    points.forEach((p, i) => {
      if (!(p instanceof c))
        throw new Error("invalid point at index " + i);
    });
  }
  function validateMSMScalars(scalars, field, maxScalar) {
    if (!Array.isArray(scalars))
      throw new Error("array of scalars expected");
    scalars.forEach((s, i) => {
      const ok = maxScalar === void 0 ? field.isValid(s) : isPosBig(s) && s < maxScalar;
      if (!ok)
        throw new Error("invalid scalar at index " + i);
    });
  }
  var pointWindowSizes = /* @__PURE__ */ new WeakMap();
  function getWindowSize(P) {
    return pointWindowSizes.get(P) || 1;
  }
  function oddMultiples(p, size) {
    const dbl = p.double();
    const t = [p];
    for (let j = 1; j < size; j++)
      t.push(t[j - 1].add(dbl));
    return t;
  }
  function wnafDigits(n, W) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const d = [];
    while (n > _0n3) {
      let w = 0;
      if (n & _1n3) {
        w = Number(n & mask);
        if (w >= half)
          w -= size;
        n -= BigInt(w);
      }
      d.push(w);
      n >>= _1n3;
    }
    return d;
  }
  function signedWindowDigits(n, W, windows) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const shiftBy = BigInt(W);
    const d = [];
    for (let w = 0; w < windows; w++) {
      let v = Number(n & mask);
      n >>= shiftBy;
      if (v > half) {
        v -= size;
        n += _1n3;
      }
      d.push(v);
    }
    if (n !== _0n3)
      throw new Error("invalid wnaf");
    return d;
  }
  function wnafWalk(zero, tables, digits) {
    let max = 0;
    for (const d of digits)
      max = Math.max(max, d.length);
    let acc = zero;
    for (let bit = max - 1; bit >= 0; bit--) {
      if (bit !== max - 1)
        acc = acc.double();
      for (let i = 0; i < digits.length; i++) {
        const w = digits[i][bit];
        if (w) {
          const item = tables[i][Math.abs(w) - 1 >> 1];
          acc = acc.add(w < 0 ? item.negate() : item);
        }
      }
    }
    return acc;
  }
  var ScalarMultiplier = class {
    // Parametrized with a given Point class (not individual point)
    constructor(Point, randomBytes3) {
      __publicField(this, "Point");
      __publicField(this, "BASE");
      __publicField(this, "ZERO");
      __publicField(this, "randomBytes");
      __publicField(this, "wnafPrecomputes", /* @__PURE__ */ new WeakMap());
      __publicField(this, "baseCanBeBlinded");
      __publicField(this, "bits");
      validatePointCons(Point);
      this.randomBytes = probeRandomBytes(randomBytes3, BLIND_BYTES);
      this.Point = Point;
      this.BASE = Point.BASE;
      this.ZERO = Point.ZERO;
      this.bits = Point.Fn.BITS;
    }
    /**
     * Creates a signed fixed-window wNAF precomputation table: for every window w, the
     * multiples `[1..2^(W−1)]⋅2^(w⋅W)⋅P`, flattened. All doublings are baked into the table,
     * so cached multiplication is additions-only. `windows = ceil(bits/W) + 1`: the extra
     * window absorbs the final carry of signed-digit recoding.
     * For a 256-bit curve and W=6, the table is 44⋅32 = 1408 points.
     * @param point - Point instance
     * @param W - window size
     * @param bits - scalar bitlength the table must cover
     */
    buildWnafTable(point, W, bits) {
      const windows = Math.ceil(bits / W) + 1;
      const half = 2 ** (W - 1);
      const comp = [];
      let base = point;
      for (let w = 0; w < windows; w++) {
        let acc = base;
        for (let i = 0; i < half; i++) {
          comp.push(acc);
          acc = acc.add(base);
        }
        base = comp[comp.length - 1].double();
      }
      return { W, bits, windows, comp };
    }
    /**
     * Implements ec multiplication using precomputed signed fixed-window wNAF tables.
     * Constant-time: fixed window count with one table addition per window — zero digits feed
     * the fake accumulator — and no doublings; the lookup scans the whole window slice.
     * Scalar bounds are validated by the public entry points ({@link ScalarMultiplier.mulCT},
     * {@link ScalarMultiplier.mulCTBlinded}, {@link ScalarMultiplier.mulUnsafe});
     * signedWindowDigits throws if `n` exceeds the table.
     * @returns real and fake (for const-time) points
     */
    wnafCachedCT(precomputes, n) {
      const { W, windows, comp } = precomputes;
      const half = 2 ** (W - 1);
      const digits = signedWindowDigits(n, W, windows);
      let p = this.ZERO;
      let f = this.BASE;
      for (let w = 0; w < windows; w++) {
        const digit = digits[w];
        const start = w * half;
        const idx = Math.abs(digit) - 1;
        let sel = comp[start];
        for (let i = 1; i < half; i++)
          sel = i === idx ? comp[start + i] : sel;
        const neg = sel.negate();
        if (digit === 0)
          f = f.add(comp[start]);
        else
          p = p.add(digit < 0 ? neg : sel);
      }
      return { p, f };
    }
    // Cache key is point identity plus (W, bits); at most two entries exist per point (public-width
    // `Fn.BITS` and blinded `Fn.BITS + BLIND_BITS`). Callers must not reuse the same point with
    // incompatible `transform(...)` layouts and expect a separate cache entry.
    getWnafPrecomputes(W, point, bits, transform) {
      let entries = this.wnafPrecomputes.get(point);
      let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
      if (!comp) {
        comp = this.buildWnafTable(point, W, bits);
        if (typeof transform === "function")
          comp = { ...comp, comp: transform(comp.comp) };
        if (!entries) {
          entries = [];
          this.wnafPrecomputes.set(point, entries);
        }
        entries.push(comp);
      }
      return comp;
    }
    assertPoint(point) {
      if (!(point instanceof this.Point))
        throw new TypeError('"point" expected Point instance, got type=' + typeof point);
    }
    // Shared prologue of the constant-time entry points. Rejects scalar 0: in key/signature-style
    // callers a zero scalar means broken upstream plumbing, and concrete Points already reject it.
    // Uses inRange instead of Fn.isValidNot0: validateField() only certifies the arithmetic subset.
    validateMulInput(point, scalar) {
      this.assertPoint(point);
      if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
        throw new Error("invalid scalar");
    }
    // Constant-time dispatch shared by mulCT / mulCTBlinded. Un-precomputed points (W===1, e.g.
    // ECDH peer keys) skip building a throwaway cached table in favor of a small fixed-window
    // multiply. `n` must be < 2^bits.
    runCT(point, n, bits, transform) {
      const W = getWindowSize(point);
      if (W === 1)
        return this.fixedWindowCT(point, n, bits);
      return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
    }
    mulCT(point, scalar, transform) {
      this.validateMulInput(point, scalar);
      return this.runCT(point, scalar, this.bits, transform);
    }
    mulCTBlinded(point, scalar, transform) {
      this.validateMulInput(point, scalar);
      if (this.randomBytes === void 0)
        throw new Error("randomBytes is required for scalar blinding");
      const bits = this.Point.Fn.BITS + BLIND_BITS;
      const blind = this.randomBytes(BLIND_BYTES);
      if (!isBytes2(blind) || blind.length !== BLIND_BYTES)
        throw new Error("randomBytes returned invalid byte array");
      blind[0] = blind[0] & 63 | 128;
      const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
      return this.runCT(point, n, bits, transform);
    }
    /**
     * Constant-time multiplication `n*point` for an un-precomputed point, via a small fixed window.
     * A cached wNAF table only pays off when reused; a flat 2^FW_WINDOW table (`size-1` adds) is
     * far cheaper to build for a single use. The point-operation sequence is independent of `n`:
     * build the table, then per window exactly FW_WINDOW doublings, a data-oblivious scan over
     * every table entry, and one addition (adds the identity when the window digit is 0 — never
     * skipped).
     *
     * `n` must be `< 2^bits`. Assumes complete addition (adding the identity costs the same as any
     * add), which holds for the Weierstrass/Edwards point types used here. The table is left in
     * projective form (no normalizeZ): normalizing this small a table costs more than the
     * mixed-add savings it would buy for a single multiply.
     * @returns real point `p`; `f` duplicates it only to match {@link wnafCachedCT}'s return shape
     * (this path needs no fake accumulator — its op-count is already scalar-independent).
     */
    fixedWindowCT(point, n, bits) {
      const W = FW_WINDOW;
      const size = 1 << W;
      const mask = bitMask(W);
      const table = new Array(size);
      table[0] = this.ZERO;
      for (let i = 1; i < size; i++)
        table[i] = table[i - 1].add(point);
      const windows = Math.ceil(bits / W);
      let acc = this.ZERO;
      for (let window2 = windows - 1; window2 >= 0; window2--) {
        if (window2 !== windows - 1)
          for (let d = 0; d < W; d++)
            acc = acc.double();
        const digit = Number(n >> BigInt(window2 * W) & mask);
        let sel = table[0];
        for (let i = 1; i < size; i++)
          sel = i === digit ? table[i] : sel;
        acc = acc.add(sel);
      }
      return { p: acc, f: acc };
    }
    shouldBlind(point, cofactor) {
      if (this.randomBytes === void 0)
        return false;
      if (cofactor === _1n3)
        return true;
      if (point !== this.BASE)
        return false;
      if (this.baseCanBeBlinded === void 0)
        this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
      return this.baseCanBeBlinded;
    }
    mulSecret(point, scalar, cofactor, transform) {
      return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
    }
    mulUnsafe(point, scalar, transform) {
      this.assertPoint(point);
      if (!isPosBig(scalar))
        throw new Error("invalid scalar");
      const W = getWindowSize(point);
      if (W === 1 || scalar >= this.Point.Fn.ORDER)
        return mulAddUnsafe(this.Point, [point], [scalar], true);
      const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
      return this.wnafCachedCT(precomputes, scalar).p;
    }
    // Remembers the window size used for precomputed wNAF multiplication of the given point
    // and drops any previously built tables. Usually only the base point is precomputed.
    // W=1 resets the point to the un-precomputed (table-less) paths.
    // W is additionally capped so tables stay under ~2 GiB ({@link TABLE_BYTES_MAX}).
    setWindowSize(point, W) {
      this.assertPoint(point);
      validateW(W, this.bits);
      const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
      validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
      pointWindowSizes.set(point, W);
      this.wnafPrecomputes.delete(point);
    }
    // True when a window size is set: tables themselves are built lazily on first multiply.
    hasWindowSize(point) {
      return getWindowSize(point) !== 1;
    }
  };
  function mulAddUnsafe(c, points, scalars, allowOversized = false) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    abool(allowOversized, "allowOversized");
    validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
    if (points.length !== scalars.length)
      throw new Error("arrays of points and scalars must have equal length");
    const tables = points.map((p) => oddMultiples(p, 4));
    const digits = scalars.map((n) => wnafDigits(n, 4));
    return wnafWalk(c.ZERO, tables, digits);
  }
  function createField(order, field, isLE) {
    if (field) {
      if (field.ORDER !== order)
        throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
      validateField(field);
      return field;
    } else {
      return Field(order, { isLE });
    }
  }
  function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
    if (type !== "weierstrass" && type !== "edwards")
      throw new Error('expected curve type "weierstrass" or "edwards"');
    if (FpFnLE === void 0)
      FpFnLE = type === "edwards";
    if (!CURVE || typeof CURVE !== "object")
      throw new Error(`expected valid ${type} CURVE object`);
    validateObject(curveOpts);
    for (const p of ["p", "n", "h"]) {
      const val = CURVE[p];
      if (!(isPosBig(val) && val !== _0n3))
        throw new Error(`CURVE.${p} must be positive bigint`);
    }
    const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
    const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
    const _b = type === "weierstrass" ? "b" : "d";
    const params = ["Gx", "Gy", "a", _b];
    for (const p of params) {
      if (!Fp.isValid(CURVE[p]))
        throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
    }
    CURVE = Object.freeze(Object.assign({}, CURVE));
    return { CURVE, Fp, Fn };
  }
  function createKeygen(randomSecretKey, getPublicKey) {
    return function keygen(seed) {
      const secretKey = randomSecretKey(seed);
      return { secretKey, publicKey: getPublicKey(secretKey) };
    };
  }

  // node_modules/@noble/curves/abstract/weierstrass.js
  var divNearest = (num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n2) / den;
  function _splitEndoScalar(k, basis, n) {
    aInRange("scalar", k, _0n4, n);
    const [[a1, b1], [a2, b2]] = basis;
    const c1 = divNearest(b2 * k, n);
    const c2 = divNearest(-b1 * k, n);
    let k1 = k - c1 * a1 - c2 * a2;
    let k2 = -c1 * b1 - c2 * b2;
    const k1neg = k1 < _0n4;
    const k2neg = k2 < _0n4;
    if (k1neg)
      k1 = -k1;
    if (k2neg)
      k2 = -k2;
    const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
    if (k1 < _0n4 || k1 >= MAX_NUM || k2 < _0n4 || k2 >= MAX_NUM) {
      throw new Error("splitScalar (endomorphism): failed for k");
    }
    return { k1neg, k1, k2neg, k2 };
  }
  var _0n4 = /* @__PURE__ */ BigInt(0);
  var _1n4 = /* @__PURE__ */ BigInt(1);
  var _2n2 = /* @__PURE__ */ BigInt(2);
  var _3n2 = /* @__PURE__ */ BigInt(3);
  var _4n3 = /* @__PURE__ */ BigInt(4);
  function weierstrass(params, extraOpts = {}) {
    const validated = createCurveFields("weierstrass", params, extraOpts);
    const Fp = validated.Fp;
    const Fn = validated.Fn;
    let CURVE = validated.CURVE;
    const { h: cofactor, n: CURVE_ORDER } = CURVE;
    validateObject(extraOpts, {}, {
      allowInfinityPoint: "boolean",
      clearCofactor: "function",
      isTorsionFree: "function",
      fromBytes: "function",
      toBytes: "function",
      endo: "object",
      randomBytes: "function"
    });
    const { endo: endoOpts, allowInfinityPoint, clearCofactor, isTorsionFree, fromBytes, toBytes } = extraOpts;
    const randomBytes3 = extraOpts.randomBytes === void 0 ? randomBytes2 : extraOpts.randomBytes;
    if (endoOpts) {
      if (!Fp.is0(CURVE.a) || typeof endoOpts.beta !== "bigint" || !Array.isArray(endoOpts.basises)) {
        throw new Error('invalid endo: expected "beta": bigint and "basises": array');
      }
    }
    const endo = endoOpts ? {
      beta: endoOpts.beta,
      basises: endoOpts.basises.map((basis) => [...basis])
    } : void 0;
    const lengths = getWLengths(Fp, Fn);
    function assertCompressionIsSupported() {
      if (!Fp.isOdd)
        throw new Error("compression is not supported: Field does not have .isOdd()");
    }
    function pointToBytes2(_c, point, isCompressed) {
      if (point.is0()) {
        if (!allowInfinityPoint)
          throw new Error("bad point: ZERO");
        return Uint8Array.of(0);
      }
      const { x, y } = point.toAffine();
      const bx = Fp.toBytes(x);
      abool(isCompressed, "isCompressed");
      if (isCompressed) {
        assertCompressionIsSupported();
        const hasEvenY = !Fp.isOdd(y);
        return concatBytes2(pprefix(hasEvenY), bx);
      } else {
        return concatBytes2(Uint8Array.of(4), bx, Fp.toBytes(y));
      }
    }
    function pointFromBytes(bytes) {
      abytes2(bytes, void 0, "Point");
      const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
      const length = bytes.length;
      const head = bytes[0];
      const tail = bytes.subarray(1);
      if (allowInfinityPoint && length === 1 && head === 0)
        return { x: Fp.ZERO, y: Fp.ZERO };
      if (length === comp && (head === 2 || head === 3)) {
        const x = Fp.fromBytes(tail);
        if (!Fp.isValid(x))
          throw new Error("bad point: is not on curve, wrong x");
        const y2 = weierstrassEquation(x);
        let y;
        try {
          y = Fp.sqrt(y2);
        } catch (sqrtError) {
          const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
          throw new Error("bad point: is not on curve, sqrt error" + err);
        }
        assertCompressionIsSupported();
        const evenY = Fp.isOdd(y);
        const evenH = (head & 1) === 1;
        if (evenH !== evenY)
          y = Fp.neg(y);
        return { x, y };
      } else if (length === uncomp && head === 4) {
        const L = Fp.BYTES;
        const x = Fp.fromBytes(tail.subarray(0, L));
        const y = Fp.fromBytes(tail.subarray(L, L * 2));
        if (!isValidXY(x, y))
          throw new Error("bad point: is not on curve");
        return { x, y };
      } else {
        throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
      }
    }
    const encodePoint = toBytes === void 0 ? pointToBytes2 : toBytes;
    const decodePoint = fromBytes === void 0 ? pointFromBytes : fromBytes;
    const b3 = Fp.mul(CURVE.b, _3n2);
    const mulA = Fp.is0(CURVE.a) ? (_) => Fp.ZERO : (x) => Fp.mul(CURVE.a, x);
    function weierstrassEquation(x) {
      const x2 = Fp.sqr(x);
      const x3 = Fp.mul(x2, x);
      return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
    }
    function isValidXY(x, y) {
      const left = Fp.sqr(y);
      const right = weierstrassEquation(x);
      return Fp.eql(left, right);
    }
    if (!isValidXY(CURVE.Gx, CURVE.Gy))
      throw new Error("bad curve params: generator point");
    const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n3);
    const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
    if (Fp.is0(Fp.add(_4a3, _27b2)))
      throw new Error("bad curve params: a or b");
    function acoord(title, n, banZero = false) {
      if (!Fp.isValid(n) || banZero && Fp.is0(n))
        throw new Error(`bad point coordinate ${title}`);
      return typeof n === "object" && n !== null ? Fp.create(n) : n;
    }
    function aprjpoint(other) {
      if (!(other instanceof Point))
        throw new Error("Weierstrass Point expected");
    }
    function splitEndoScalarN(k) {
      if (!endo || !endo.basises)
        throw new Error("no endo");
      return _splitEndoScalar(k, endo.basises, Fn.ORDER);
    }
    function pushWnafPair(points, scalars, p, k) {
      if (!Fn.isValid(k))
        throw new RangeError("invalid scalar: out of range");
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(k);
        const psi = new Point(Fp.mul(p.X, endo.beta), p.Y, p.Z);
        points.push(k1neg ? p.negate() : p, k2neg ? psi.negate() : psi);
        scalars.push(k1, k2);
      } else {
        points.push(p);
        scalars.push(k);
      }
    }
    const validityCache = /* @__PURE__ */ new WeakSet();
    const _Point = class _Point {
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      constructor(X, Y, Z) {
        __publicField(this, "X");
        __publicField(this, "Y");
        __publicField(this, "Z");
        this.X = acoord("x", X);
        this.Y = acoord("y", Y, true);
        this.Z = acoord("z", Z);
        Object.freeze(this);
      }
      static CURVE() {
        return CURVE;
      }
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      static fromAffine(p) {
        const { x, y } = p || {};
        if (!p || !Fp.isValid(x) || !Fp.isValid(y))
          throw new Error("invalid affine point");
        if (p instanceof _Point)
          throw new Error("projective point not allowed");
        if (Fp.is0(x) && Fp.is0(y))
          return _Point.ZERO;
        return new _Point(x, y, Fp.ONE);
      }
      static fromBytes(bytes) {
        const P = _Point.fromAffine(decodePoint(abytes2(bytes, void 0, "point")));
        P.assertValidity();
        return P;
      }
      static fromHex(hex) {
        return _Point.fromBytes(hexToBytes2(hex));
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      /**
       * @param isLazy - true will defer table computation until the first multiplication
       */
      precompute(windowSize = 6, isLazy = true) {
        wnaf.setWindowSize(this, windowSize);
        if (!isLazy)
          this.multiply(_3n2);
        return this;
      }
      // TODO: return `this`
      /** A point on curve is valid if it conforms to equation. */
      assertValidity() {
        const p = this;
        if (p.is0()) {
          if (allowInfinityPoint && Fp.is0(p.X) && Fp.eql(p.Y, Fp.ONE) && Fp.is0(p.Z))
            return;
          throw new Error("bad point: ZERO");
        }
        if (validityCache.has(p))
          return;
        const { x, y } = p.toAffine();
        if (!Fp.isValid(x) || !Fp.isValid(y))
          throw new Error("bad point: x or y not field elements");
        if (!isValidXY(x, y))
          throw new Error("bad point: equation left != right");
        if (!p.isTorsionFree())
          throw new Error("bad point: not in prime-order subgroup");
        validityCache.add(p);
      }
      hasEvenY() {
        const { y } = this.toAffine();
        if (!Fp.isOdd)
          throw new Error("Field doesn't support isOdd");
        return !Fp.isOdd(y);
      }
      /** Compare one point to another. */
      equals(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
        const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
        return U1 && U2;
      }
      /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
      negate() {
        return new _Point(this.X, Fp.neg(this.Y), this.Z);
      }
      // Renes-Costello-Batina exception-free doubling formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 3
      // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
      double() {
        const { X: X1, Y: Y1, Z: Z1 } = this;
        let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
        let t0 = Fp.mul(X1, X1);
        let t1 = Fp.mul(Y1, Y1);
        let t2 = Fp.mul(Z1, Z1);
        let t3 = Fp.mul(X1, Y1);
        t3 = Fp.add(t3, t3);
        Z3 = Fp.mul(X1, Z1);
        Z3 = Fp.add(Z3, Z3);
        X3 = mulA(Z3);
        Y3 = Fp.mul(b3, t2);
        Y3 = Fp.add(X3, Y3);
        X3 = Fp.sub(t1, Y3);
        Y3 = Fp.add(t1, Y3);
        Y3 = Fp.mul(X3, Y3);
        X3 = Fp.mul(t3, X3);
        Z3 = Fp.mul(b3, Z3);
        t2 = mulA(t2);
        t3 = Fp.sub(t0, t2);
        t3 = mulA(t3);
        t3 = Fp.add(t3, Z3);
        Z3 = Fp.add(t0, t0);
        t0 = Fp.add(Z3, t0);
        t0 = Fp.add(t0, t2);
        t0 = Fp.mul(t0, t3);
        Y3 = Fp.add(Y3, t0);
        t2 = Fp.mul(Y1, Z1);
        t2 = Fp.add(t2, t2);
        t0 = Fp.mul(t2, t3);
        X3 = Fp.sub(X3, t0);
        Z3 = Fp.mul(t2, t1);
        Z3 = Fp.add(Z3, Z3);
        Z3 = Fp.add(Z3, Z3);
        return new _Point(X3, Y3, Z3);
      }
      // Renes-Costello-Batina exception-free addition formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 1
      // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
      add(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
        let t0 = Fp.mul(X1, X2);
        let t1 = Fp.mul(Y1, Y2);
        let t2 = Fp.mul(Z1, Z2);
        let t3 = Fp.add(X1, Y1);
        let t4 = Fp.add(X2, Y2);
        t3 = Fp.mul(t3, t4);
        t4 = Fp.add(t0, t1);
        t3 = Fp.sub(t3, t4);
        t4 = Fp.add(X1, Z1);
        let t5 = Fp.add(X2, Z2);
        t4 = Fp.mul(t4, t5);
        t5 = Fp.add(t0, t2);
        t4 = Fp.sub(t4, t5);
        t5 = Fp.add(Y1, Z1);
        X3 = Fp.add(Y2, Z2);
        t5 = Fp.mul(t5, X3);
        X3 = Fp.add(t1, t2);
        t5 = Fp.sub(t5, X3);
        Z3 = mulA(t4);
        X3 = Fp.mul(b3, t2);
        Z3 = Fp.add(X3, Z3);
        X3 = Fp.sub(t1, Z3);
        Z3 = Fp.add(t1, Z3);
        Y3 = Fp.mul(X3, Z3);
        t1 = Fp.add(t0, t0);
        t1 = Fp.add(t1, t0);
        t2 = mulA(t2);
        t4 = Fp.mul(b3, t4);
        t1 = Fp.add(t1, t2);
        t2 = Fp.sub(t0, t2);
        t2 = mulA(t2);
        t4 = Fp.add(t4, t2);
        t0 = Fp.mul(t1, t4);
        Y3 = Fp.add(Y3, t0);
        t0 = Fp.mul(t5, t4);
        X3 = Fp.mul(t3, X3);
        X3 = Fp.sub(X3, t0);
        t0 = Fp.mul(t3, t1);
        Z3 = Fp.mul(t5, Z3);
        Z3 = Fp.add(Z3, t0);
        return new _Point(X3, Y3, Z3);
      }
      subtract(other) {
        aprjpoint(other);
        return this.add(other.negate());
      }
      is0() {
        return this.equals(_Point.ZERO);
      }
      /**
       * Constant time multiplication.
       * Uses precomputed tables (signed fixed-window wNAF) when available.
       * Uses scalar blinding and avoids endomorphism splitting in the secret-scalar path.
       * @param scalar - by which the point would be multiplied
       * @returns New point
       */
      multiply(scalar) {
        if (!Fn.isValidNot0(scalar))
          throw new RangeError("invalid scalar: out of range");
        const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
        return normalize([p, f])[0];
      }
      /**
       * Non-constant-time multiplication. Uses width-4 wNAF with GLV endomorphism splitting
       * when available (two half-width scalars sharing one halved doubling chain).
       * It's faster, but should only be used when you don't care about
       * an exposed secret key e.g. sig verification, which works over *public* keys.
       */
      multiplyUnsafe(scalar) {
        const p = this;
        const sc = scalar;
        if (!Fn.isValid(sc))
          throw new RangeError("invalid scalar: out of range");
        if (sc === _0n4 || p.is0())
          return _Point.ZERO;
        if (sc === _1n4)
          return p;
        if (wnaf.hasWindowSize(this))
          return wnaf.mulUnsafe(p, sc, normalize);
        const points = [];
        const scalars = [];
        pushWnafPair(points, scalars, p, sc);
        return mulAddUnsafe(_Point, points, scalars);
      }
      /**
       * Non-constant-time double-scalar multiplication `a⋅this + b⋅other` (Strauss–Shamir).
       * Both walks share one doubling chain via {@link mulAddUnsafe}, and GLV endomorphism
       * (when available) halves the chain again by splitting each scalar into two half-width
       * parts. Used by ECDSA verification and public-key recovery for `R = u1⋅G + u2⋅P`.
       * Only for public scalars.
       */
      mulAddUnsafe(a, other, b) {
        aprjpoint(other);
        const points = [];
        const scalars = [];
        pushWnafPair(points, scalars, this, a);
        pushWnafPair(points, scalars, other, b);
        return mulAddUnsafe(_Point, points, scalars);
      }
      /**
       * Converts Projective point to affine (x, y) coordinates.
       * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
       * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
       */
      toAffine(invertedZ) {
        const p = this;
        let iz = invertedZ;
        if (iz != null && !Fp.isValid(iz))
          throw new RangeError('"invertedZ" expected valid field element');
        const { X, Y, Z } = p;
        if (Fp.eql(Z, Fp.ONE))
          return { x: X, y: Y };
        const is0 = p.is0();
        if (iz == null)
          iz = is0 ? Fp.ONE : Fp.inv(Z);
        const x = Fp.mul(X, iz);
        const y = Fp.mul(Y, iz);
        const zz = Fp.mul(Z, iz);
        if (is0)
          return { x: Fp.ZERO, y: Fp.ZERO };
        if (!Fp.eql(zz, Fp.ONE))
          throw new Error("invZ was invalid");
        return { x, y };
      }
      /**
       * Checks whether Point is free of torsion elements (is in prime subgroup).
       * Always torsion-free for cofactor=1 curves.
       */
      isTorsionFree() {
        if (cofactor === _1n4)
          return true;
        if (isTorsionFree)
          return isTorsionFree(_Point, this);
        return wnaf.mulUnsafe(this, CURVE_ORDER).is0();
      }
      clearCofactor() {
        if (cofactor === _1n4)
          return this;
        if (clearCofactor)
          return clearCofactor(_Point, this);
        return this.multiplyUnsafe(cofactor);
      }
      isSmallOrder() {
        if (cofactor === _1n4)
          return this.is0();
        return this.clearCofactor().is0();
      }
      toBytes(isCompressed = true) {
        abool(isCompressed, "isCompressed");
        this.assertValidity();
        return encodePoint(_Point, this, isCompressed);
      }
      toHex(isCompressed = true) {
        return bytesToHex2(this.toBytes(isCompressed));
      }
      toString() {
        return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
      }
    };
    __publicField(_Point, "BASE", new _Point(CURVE.Gx, CURVE.Gy, Fp.ONE));
    __publicField(_Point, "ZERO", new _Point(Fp.ZERO, Fp.ONE, Fp.ZERO));
    __publicField(_Point, "Fp", Fp);
    __publicField(_Point, "Fn", Fn);
    let Point = _Point;
    const normalize = (points) => normalizeZ(Point, points);
    const wnaf = new ScalarMultiplier(Point, randomBytes3);
    if (wnaf.bits >= 6)
      Point.BASE.precompute(6);
    Object.freeze(Point.prototype);
    Object.freeze(Point);
    return Point;
  }
  function pprefix(hasEvenY) {
    return Uint8Array.of(hasEvenY ? 2 : 3);
  }
  function getWLengths(Fp, Fn) {
    return {
      secretKey: Fn.BYTES,
      publicKey: 1 + Fp.BYTES,
      publicKeyUncompressed: 1 + 2 * Fp.BYTES,
      publicKeyHasPrefix: true,
      // Raw compact `(r || s)` signature width; DER and recovered signatures use
      // different lengths outside this helper.
      signature: 2 * Fn.BYTES
    };
  }

  // node_modules/@noble/curves/secp256k1.js
  var secp256k1_CURVE = {
    p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
    n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
    h: BigInt(1),
    a: BigInt(0),
    b: BigInt(7),
    Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
    Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
  };
  var secp256k1_ENDO = {
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    basises: [
      [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
      [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
    ]
  };
  var _0n5 = /* @__PURE__ */ BigInt(0);
  var _2n3 = /* @__PURE__ */ BigInt(2);
  function sqrtMod(y) {
    const P = secp256k1_CURVE.p;
    const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
    const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
    const b2 = y * y * y % P;
    const b3 = b2 * b2 * y % P;
    const b6 = pow2(b3, _3n3, P) * b3 % P;
    const b9 = pow2(b6, _3n3, P) * b3 % P;
    const b11 = pow2(b9, _2n3, P) * b2 % P;
    const b22 = pow2(b11, _11n, P) * b11 % P;
    const b44 = pow2(b22, _22n, P) * b22 % P;
    const b88 = pow2(b44, _44n, P) * b44 % P;
    const b176 = pow2(b88, _88n, P) * b88 % P;
    const b220 = pow2(b176, _44n, P) * b44 % P;
    const b223 = pow2(b220, _3n3, P) * b3 % P;
    const t1 = pow2(b223, _23n, P) * b22 % P;
    const t2 = pow2(t1, _6n, P) * b2 % P;
    const root = pow2(t2, _2n3, P);
    if (!Fpk1.eql(Fpk1.sqr(root), y))
      throw new Error("Cannot find square root");
    return root;
  }
  var Fpk1 = /* @__PURE__ */ Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
  var Pointk1 = /* @__PURE__ */ weierstrass(secp256k1_CURVE, {
    Fp: Fpk1,
    endo: secp256k1_ENDO
  });
  var TAGGED_HASH_PREFIXES = /* @__PURE__ */ Object.create(null);
  function taggedHash(tag, ...messages) {
    let tagP = TAGGED_HASH_PREFIXES[tag];
    if (tagP === void 0) {
      const tagH = sha256(asciiToBytes(tag));
      tagP = concatBytes2(tagH, tagH);
      TAGGED_HASH_PREFIXES[tag] = tagP;
    }
    return sha256(concatBytes2(tagP, ...messages));
  }
  var pointToBytes = (point) => point.toBytes(true).slice(1);
  var affineXToBytes = ({ x }) => Fpk1.toBytes(x);
  var hasEven = (y) => !Fpk1.isOdd(y);
  function schnorrGetExtPubKey(priv) {
    const { Fn, BASE } = Pointk1;
    const d_ = Fn.fromBytes(abytes2(priv, 32, "secretKey"));
    const p = BASE.multiply(d_);
    const affine = p.toAffine();
    const scalar = hasEven(affine.y) ? d_ : Fn.neg(d_);
    return { scalar, bytes: affineXToBytes(affine) };
  }
  function lift_x(x) {
    const Fp = Fpk1;
    if (!Fp.isValidNot0(x))
      throw new Error("invalid x: Fail if x \u2265 p");
    const xx = Fp.sqr(x);
    const c = Fp.add(Fp.mulN(xx, x), BigInt(7));
    let y = Fp.sqrt(c);
    if (!hasEven(y))
      y = Fp.neg(y);
    const p = Pointk1.fromAffine({ x, y });
    p.assertValidity();
    return p;
  }
  var num = bytesToNumberBE;
  function challenge(...args) {
    return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
  }
  function schnorrGetPublicKey(secretKey) {
    return schnorrGetExtPubKey(secretKey).bytes;
  }
  function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
    const { Fn, BASE } = Pointk1;
    const m = copyBytes(abytes2(message, void 0, "message"));
    const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
    const a = abytes2(auxRand, 32, "auxRand");
    const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
    const rand = taggedHash("BIP0340/nonce", t, px, m);
    const k_ = Fn.create(num(rand));
    if (k_ === _0n5)
      throw new Error("sign failed: k is zero");
    const p = BASE.multiply(k_);
    const affine = p.toAffine();
    const k = hasEven(affine.y) ? k_ : Fn.neg(k_);
    const rx = affineXToBytes(affine);
    const e2 = challenge(rx, px, m);
    const sig = new Uint8Array(64);
    sig.set(rx, 0);
    sig.set(Fn.toBytes(Fn.create(k + e2 * d)), 32);
    if (!schnorrVerify(sig, m, px))
      throw new Error("sign: Invalid signature produced");
    return sig;
  }
  function schnorrVerify(signature, message, publicKey) {
    const { Fp, Fn, BASE } = Pointk1;
    const sig = abytes2(signature, 64, "signature");
    const m = abytes2(message, void 0, "message");
    const pub = abytes2(publicKey, 32, "publicKey");
    try {
      const P = lift_x(num(pub));
      const rBytes = sig.subarray(0, 32);
      const r = num(rBytes);
      if (!Fp.isValidNot0(r))
        return false;
      const s = num(sig.subarray(32, 64));
      if (!Fn.isValidNot0(s))
        return false;
      const e2 = challenge(rBytes, pointToBytes(P), m);
      const R = BASE.mulAddUnsafe(s, P, Fn.neg(e2));
      const { x, y } = R.toAffine();
      if (R.is0() || !hasEven(y) || !Fp.eql(x, r))
        return false;
      return true;
    } catch (error) {
      return false;
    }
  }
  var schnorr = /* @__PURE__ */ (() => {
    const size = 32;
    const seedLength = 48;
    const randomSecretKey = (seed) => {
      seed = seed === void 0 ? randomBytes(seedLength) : seed;
      return mapHashToField(abytes2(seed, seedLength, "seed"), secp256k1_CURVE.n);
    };
    return Object.freeze({
      keygen: createKeygen(randomSecretKey, schnorrGetPublicKey),
      getPublicKey: schnorrGetPublicKey,
      sign: schnorrSign,
      verify: schnorrVerify,
      Point: Pointk1,
      utils: Object.freeze({
        randomSecretKey,
        taggedHash,
        lift_x,
        pointToBytes
      }),
      lengths: Object.freeze({
        secretKey: size,
        publicKey: size,
        publicKeyHasPrefix: false,
        signature: size * 2,
        seed: seedLength
      })
    });
  })();

  // node_modules/@solana/wallet-standard-util/lib/esm/signIn.js
  var DOMAIN = "(?<domain>[^\\n]+?) wants you to sign in with your Solana account:\\n";
  var ADDRESS = "(?<address>[^\\n]+)(?:\\n|$)";
  var STATEMENT = "(?:\\n(?<statement>[\\S\\s]*?)(?:\\n|$))??";
  var URI = "(?:\\nURI: (?<uri>[^\\n]+))?";
  var VERSION = "(?:\\nVersion: (?<version>[^\\n]+))?";
  var CHAIN_ID = "(?:\\nChain ID: (?<chainId>[^\\n]+))?";
  var NONCE = "(?:\\nNonce: (?<nonce>[^\\n]+))?";
  var ISSUED_AT = "(?:\\nIssued At: (?<issuedAt>[^\\n]+))?";
  var EXPIRATION_TIME = "(?:\\nExpiration Time: (?<expirationTime>[^\\n]+))?";
  var NOT_BEFORE = "(?:\\nNot Before: (?<notBefore>[^\\n]+))?";
  var REQUEST_ID = "(?:\\nRequest ID: (?<requestId>[^\\n]+))?";
  var RESOURCES = "(?:\\nResources:(?<resources>(?:\\n- [^\\n]+)*))?";
  var FIELDS = `${URI}${VERSION}${CHAIN_ID}${NONCE}${ISSUED_AT}${EXPIRATION_TIME}${NOT_BEFORE}${REQUEST_ID}${RESOURCES}`;
  var MESSAGE = new RegExp(`^${DOMAIN}${ADDRESS}${STATEMENT}${FIELDS}\\n*$`);
  function createSignInMessageText(input) {
    let message = `${input.domain} wants you to sign in with your Solana account:
`;
    message += `${input.address}`;
    if (input.statement) {
      message += `

${input.statement}`;
    }
    const fields = [];
    if (input.uri) {
      fields.push(`URI: ${input.uri}`);
    }
    if (input.version) {
      fields.push(`Version: ${input.version}`);
    }
    if (input.chainId) {
      fields.push(`Chain ID: ${input.chainId}`);
    }
    if (input.nonce) {
      fields.push(`Nonce: ${input.nonce}`);
    }
    if (input.issuedAt) {
      fields.push(`Issued At: ${input.issuedAt}`);
    }
    if (input.expirationTime) {
      fields.push(`Expiration Time: ${input.expirationTime}`);
    }
    if (input.notBefore) {
      fields.push(`Not Before: ${input.notBefore}`);
    }
    if (input.requestId) {
      fields.push(`Request ID: ${input.requestId}`);
    }
    if (input.resources) {
      fields.push(`Resources:`);
      for (const resource of input.resources) {
        fields.push(`- ${resource}`);
      }
    }
    if (fields.length) {
      message += `

${fields.join("\n")}`;
    }
    return message;
  }

  // node_modules/@solana-mobile/mobile-wallet-adapter-protocol/lib/esm/index.browser.js
  var SolanaMobileWalletAdapterErrorCode = {
    ERROR_ASSOCIATION_PORT_OUT_OF_RANGE: "ERROR_ASSOCIATION_PORT_OUT_OF_RANGE",
    ERROR_REFLECTOR_ID_OUT_OF_RANGE: "ERROR_REFLECTOR_ID_OUT_OF_RANGE",
    ERROR_FORBIDDEN_WALLET_BASE_URL: "ERROR_FORBIDDEN_WALLET_BASE_URL",
    ERROR_SECURE_CONTEXT_REQUIRED: "ERROR_SECURE_CONTEXT_REQUIRED",
    ERROR_SESSION_CLOSED: "ERROR_SESSION_CLOSED",
    ERROR_SESSION_TIMEOUT: "ERROR_SESSION_TIMEOUT",
    ERROR_WALLET_NOT_FOUND: "ERROR_WALLET_NOT_FOUND",
    ERROR_INVALID_PROTOCOL_VERSION: "ERROR_INVALID_PROTOCOL_VERSION",
    ERROR_BROWSER_NOT_SUPPORTED: "ERROR_BROWSER_NOT_SUPPORTED",
    ERROR_LOOPBACK_ACCESS_BLOCKED: "ERROR_LOOPBACK_ACCESS_BLOCKED",
    ERROR_ASSOCIATION_CANCELLED: "ERROR_ASSOCIATION_CANCELLED",
    ERROR_ILLEGAL_TRANSPORT_STATE: "ERROR_ILLEGAL_TRANSPORT_STATE"
  };
  var SolanaMobileWalletAdapterError = class extends Error {
    constructor(...args) {
      const [code, message, data] = args;
      super(message);
      __publicField(this, "data");
      __publicField(this, "code");
      this.code = code;
      this.data = data;
      this.name = "SolanaMobileWalletAdapterError";
    }
  };
  var SolanaMobileWalletAdapterProtocolError = class extends Error {
    constructor(...args) {
      const [jsonRpcMessageId, code, message, data] = args;
      super(message);
      __publicField(this, "data");
      __publicField(this, "code");
      __publicField(this, "jsonRpcMessageId");
      this.code = code;
      this.data = data;
      this.jsonRpcMessageId = jsonRpcMessageId;
      this.name = "SolanaMobileWalletAdapterProtocolError";
    }
  };
  var NOSTR_EVENT_KIND_MWA = 20012;
  function generateNostrKeypair() {
    const privateKey = schnorr.utils.randomSecretKey();
    return {
      privateKey,
      publicKey: bytesToHex(schnorr.getPublicKey(privateKey))
    };
  }
  async function deriveSessionIdentifier(associationPublicKey) {
    const rawKey = await crypto.subtle.exportKey("raw", associationPublicKey);
    const hash = sha256(new Uint8Array(rawKey));
    return bytesToHex(hash);
  }
  function serializeEvent(pubkey, createdAt, kind, tags, content) {
    return JSON.stringify([
      0,
      pubkey,
      createdAt,
      kind,
      tags,
      content
    ]);
  }
  function computeEventId(pubkey, createdAt, kind, tags, content) {
    const serialized = serializeEvent(pubkey, createdAt, kind, tags, content);
    return bytesToHex(sha256(new TextEncoder().encode(serialized)));
  }
  function createNostrEvent(kind, content, tags, privateKey) {
    const pubkey = bytesToHex(schnorr.getPublicKey(privateKey));
    const createdAt = Math.floor(Date.now() / 1e3);
    const id = computeEventId(pubkey, createdAt, kind, tags, content);
    return {
      id,
      pubkey,
      created_at: createdAt,
      kind,
      tags,
      content,
      sig: bytesToHex(schnorr.sign(hexToBytes(id), privateKey))
    };
  }
  function verifyNostrEvent(event) {
    if (computeEventId(event.pubkey, event.created_at, event.kind, event.tags, event.content) !== event.id) return false;
    try {
      return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
    } catch {
      return false;
    }
  }
  async function createHelloReq(ecdhPublicKey, associationKeypairPrivateKey) {
    const publicKeyBuffer = await crypto.subtle.exportKey("raw", ecdhPublicKey);
    const signatureBuffer = await crypto.subtle.sign({
      hash: "SHA-256",
      name: "ECDSA"
    }, associationKeypairPrivateKey, publicKeyBuffer);
    const response = new Uint8Array(publicKeyBuffer.byteLength + signatureBuffer.byteLength);
    response.set(new Uint8Array(publicKeyBuffer), 0);
    response.set(new Uint8Array(signatureBuffer), publicKeyBuffer.byteLength);
    return response;
  }
  function createSIWSMessage(payload) {
    return createSignInMessageText(payload);
  }
  function createSIWSMessageBase64Url(payload) {
    return encode(createSIWSMessage(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  var SolanaSignTransactions = "solana:signTransactions";
  var SolanaCloneAuthorization = "solana:cloneAuthorization";
  function createMobileWalletProxy(protocolVersion, protocolRequestHandler) {
    return new Proxy({}, {
      get(target, p) {
        if (p === "then") return null;
        if (target[p] == null) target[p] = async function(inputParams) {
          const { method, params } = handleMobileWalletRequest(p, inputParams, protocolVersion);
          const result = await protocolRequestHandler(method, params);
          if (method === "authorize" && params.sign_in_payload && !result.sign_in_result) result.sign_in_result = await signInFallback(params.sign_in_payload, result, protocolRequestHandler);
          return handleMobileWalletResponse(p, result, protocolVersion);
        };
        return target[p];
      },
      defineProperty() {
        return false;
      },
      deleteProperty() {
        return false;
      }
    });
  }
  function handleMobileWalletRequest(methodName, methodParams, protocolVersion) {
    let params = methodParams;
    let method = methodName.toString().replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).toLowerCase();
    switch (methodName) {
      case "authorize": {
        const authorizeParams = params;
        let { chain } = authorizeParams;
        if (protocolVersion === "legacy") {
          switch (chain) {
            case "solana:testnet":
              chain = "testnet";
              break;
            case "solana:devnet":
              chain = "devnet";
              break;
            case "solana:mainnet":
              chain = "mainnet-beta";
              break;
            default:
              chain = authorizeParams.cluster;
          }
          authorizeParams.cluster = chain;
          params = authorizeParams;
        } else {
          switch (chain) {
            case "testnet":
            case "devnet":
              chain = `solana:${chain}`;
              break;
            case "mainnet-beta":
              chain = "solana:mainnet";
          }
          authorizeParams.chain = chain;
          params = authorizeParams;
        }
      }
      case "reauthorize": {
        const { auth_token, identity } = params;
        if (auth_token) switch (protocolVersion) {
          case "legacy":
            method = "reauthorize";
            params = {
              auth_token,
              identity
            };
            break;
          default:
            method = "authorize";
        }
        break;
      }
    }
    return {
      method,
      params
    };
  }
  function handleMobileWalletResponse(method, response, protocolVersion) {
    switch (method) {
      case "getCapabilities": {
        const capabilities = response;
        switch (protocolVersion) {
          case "legacy": {
            const features = [SolanaSignTransactions];
            if (capabilities.supports_clone_authorization === true) features.push(SolanaCloneAuthorization);
            return {
              ...capabilities,
              features
            };
          }
          case "v1":
            return {
              ...capabilities,
              supports_sign_and_send_transactions: true,
              supports_clone_authorization: capabilities.features.includes(SolanaCloneAuthorization)
            };
        }
      }
    }
    return response;
  }
  async function signInFallback(signInPayload, authorizationResult, protocolRequestHandler) {
    const domain = signInPayload.domain ?? window.location.host;
    const address = authorizationResult.accounts[0].address;
    const siwsMessage = createSIWSMessageBase64Url({
      ...signInPayload,
      domain,
      address: base64ToBase58$1(address)
    });
    const signMessageResult = await protocolRequestHandler("sign_messages", {
      addresses: [address],
      payloads: [siwsMessage]
    });
    const signedPayload = toUint8Array$1(signMessageResult.signed_payloads[0]);
    const signedMessage = fromUint8Array$1(signedPayload.slice(0, signedPayload.length - 64));
    const signature = fromUint8Array$1(signedPayload.slice(signedPayload.length - 64));
    return {
      address,
      signed_message: signedMessage.length == 0 ? siwsMessage : signedMessage,
      signature
    };
  }
  function createSequenceNumberVector(sequenceNumber) {
    if (sequenceNumber >= 4294967296) throw new Error("Outbound sequence number overflow. The maximum sequence number is 32-bytes.");
    const byteArray = /* @__PURE__ */ new ArrayBuffer(4);
    new DataView(byteArray).setUint32(0, sequenceNumber, false);
    return new Uint8Array(byteArray);
  }
  var INITIALIZATION_VECTOR_BYTES = 12;
  async function encryptMessage(plaintext, sequenceNumber, sharedSecret) {
    const sequenceNumberVector = createSequenceNumberVector(sequenceNumber);
    const initializationVector = new Uint8Array(INITIALIZATION_VECTOR_BYTES);
    crypto.getRandomValues(initializationVector);
    const ciphertext = await crypto.subtle.encrypt(getAlgorithmParams(sequenceNumberVector, initializationVector), sharedSecret, utf8ToUint8Array(plaintext));
    const response = new Uint8Array(sequenceNumberVector.byteLength + initializationVector.byteLength + ciphertext.byteLength);
    response.set(new Uint8Array(sequenceNumberVector), 0);
    response.set(new Uint8Array(initializationVector), sequenceNumberVector.byteLength);
    response.set(new Uint8Array(ciphertext), sequenceNumberVector.byteLength + initializationVector.byteLength);
    return response;
  }
  async function decryptMessage(message, sharedSecret) {
    const sequenceNumberVector = message.slice(0, 4);
    const initializationVector = message.slice(4, 16);
    const ciphertext = message.slice(16);
    const plaintextBuffer = await crypto.subtle.decrypt(getAlgorithmParams(sequenceNumberVector, initializationVector), sharedSecret, ciphertext);
    return utf8FromUint8Array(new Uint8Array(plaintextBuffer));
  }
  function getAlgorithmParams(sequenceNumber, initializationVector) {
    return {
      additionalData: sequenceNumber,
      iv: initializationVector,
      name: "AES-GCM",
      tagLength: 128
    };
  }
  async function generateAssociationKeypair() {
    return await crypto.subtle.generateKey({
      name: "ECDSA",
      namedCurve: "P-256"
    }, false, ["sign"]);
  }
  async function generateECDHKeypair() {
    return await crypto.subtle.generateKey({
      name: "ECDH",
      namedCurve: "P-256"
    }, false, ["deriveKey", "deriveBits"]);
  }
  function getRandomAssociationPort() {
    return assertAssociationPort(49152 + Math.floor(Math.random() * 16384));
  }
  function assertAssociationPort(port) {
    if (port < 49152 || port > 65535) throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_PORT_OUT_OF_RANGE, `Association port number must be between 49152 and 65535. ${port} given.`, { port });
    return port;
  }
  function getStringWithURLUnsafeBase64CharactersReplaced(unsafeBase64EncodedString) {
    return unsafeBase64EncodedString.replace(/[/+=]/g, (m) => ({
      "/": "_",
      "+": "-",
      "=": "."
    })[m]);
  }
  var INTENT_NAME = "solana-wallet";
  function getPathParts(pathString) {
    return pathString.replace(/(^\/+|\/+$)/g, "").split("/");
  }
  function getIntentURL(methodPathname, intentUrlBase) {
    let baseUrl = null;
    if (intentUrlBase) {
      try {
        baseUrl = new URL(intentUrlBase);
      } catch {
      }
      if (baseUrl?.protocol !== "https:") throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_FORBIDDEN_WALLET_BASE_URL, "Base URLs supplied by wallets must be valid `https` URLs");
    }
    baseUrl || (baseUrl = new URL(`${INTENT_NAME}:/`));
    const pathname = methodPathname.startsWith("/") ? methodPathname : [...getPathParts(baseUrl.pathname), ...getPathParts(methodPathname)].join("/");
    return new URL(pathname, baseUrl);
  }
  async function getAssociateAndroidIntentURL(associationPublicKey, putativePort, associationURLBase, protocolVersions = ["v1"]) {
    const associationPort = assertAssociationPort(putativePort);
    const exportedKey = await crypto.subtle.exportKey("raw", associationPublicKey);
    const encodedKey = arrayBufferToBase64String(exportedKey);
    const url = getIntentURL("v1/associate/local", associationURLBase);
    url.searchParams.set("association", getStringWithURLUnsafeBase64CharactersReplaced(encodedKey));
    url.searchParams.set("port", `${associationPort}`);
    protocolVersions.forEach((version) => {
      url.searchParams.set("v", version);
    });
    return url;
  }
  async function getRemoteAssociateAndroidIntentURL(associationPublicKey, hostAuthority, reflectorId, associationURLBase, protocolVersions = ["v1"]) {
    const exportedKey = await crypto.subtle.exportKey("raw", associationPublicKey);
    const encodedKey = arrayBufferToBase64String(exportedKey);
    const url = getIntentURL("v1/associate/remote", associationURLBase);
    url.searchParams.set("association", getStringWithURLUnsafeBase64CharactersReplaced(encodedKey));
    url.searchParams.set("reflector", `${hostAuthority}`);
    url.searchParams.set("id", `${fromUint8Array$1(reflectorId, true)}`);
    protocolVersions.forEach((version) => {
      url.searchParams.set("v", version);
    });
    return url;
  }
  async function getNostrAssociateAndroidIntentURL(associationPublicKey, connectionType, relayDomain, dappNostrPubkey, associationURLBase, protocolVersions = ["v1"]) {
    const exportedKey = await crypto.subtle.exportKey("raw", associationPublicKey);
    const encodedKey = arrayBufferToBase64String(exportedKey);
    const url = getIntentURL(`v1/associate/${connectionType}/nostr`, associationURLBase);
    url.searchParams.set("association", getStringWithURLUnsafeBase64CharactersReplaced(encodedKey));
    url.searchParams.set("relay", relayDomain);
    url.searchParams.set("pubkey", dappNostrPubkey);
    protocolVersions.forEach((version) => {
      url.searchParams.set("v", version);
    });
    return url;
  }
  async function encryptJsonRpcMessage(jsonRpcMessage, sharedSecret) {
    const plaintext = JSON.stringify(jsonRpcMessage);
    const sequenceNumber = jsonRpcMessage.id;
    return encryptMessage(plaintext, sequenceNumber, sharedSecret);
  }
  async function decryptJsonRpcMessage(message, sharedSecret) {
    const plaintext = await decryptMessage(message, sharedSecret);
    const jsonRpcMessage = JSON.parse(plaintext);
    if (Object.hasOwnProperty.call(jsonRpcMessage, "error")) throw new SolanaMobileWalletAdapterProtocolError(jsonRpcMessage.id, jsonRpcMessage.error.code, jsonRpcMessage.error.message);
    return jsonRpcMessage;
  }
  async function parseHelloRsp(payloadBuffer, associationPublicKey, ecdhPrivateKey) {
    const [associationPublicKeyBuffer, walletPublicKey] = await Promise.all([crypto.subtle.exportKey("raw", associationPublicKey), crypto.subtle.importKey("raw", payloadBuffer.slice(0, 65), {
      name: "ECDH",
      namedCurve: "P-256"
    }, false, [])]);
    const sharedSecret = await crypto.subtle.deriveBits({
      name: "ECDH",
      public: walletPublicKey
    }, ecdhPrivateKey, 256);
    const ecdhSecretKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey({
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(associationPublicKeyBuffer),
      info: /* @__PURE__ */ new Uint8Array()
    }, ecdhSecretKey, {
      name: "AES-GCM",
      length: 128
    }, false, ["encrypt", "decrypt"]);
  }
  async function parseSessionProps(message, sharedSecret) {
    const plaintext = await decryptMessage(message, sharedSecret);
    const jsonProperties = JSON.parse(plaintext);
    let protocolVersion = "legacy";
    if (Object.hasOwnProperty.call(jsonProperties, "v")) switch (jsonProperties.v) {
      case 1:
      case "1":
      case "v1":
        protocolVersion = "v1";
        break;
      case "legacy":
        protocolVersion = "legacy";
        break;
      default:
        throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_INVALID_PROTOCOL_VERSION, `Unknown/unsupported protocol version: ${jsonProperties.v}`);
    }
    return { protocol_version: protocolVersion };
  }
  var Browser = {
    Firefox: 0,
    Other: 1
  };
  function getBrowser() {
    return navigator.userAgent.indexOf("Firefox/") !== -1 ? Browser.Firefox : Browser.Other;
  }
  function getDetectionPromise() {
    return new Promise((resolve, reject) => {
      function cleanup() {
        clearTimeout(timeoutId);
        window.removeEventListener("blur", handleBlur);
      }
      function handleBlur() {
        cleanup();
        resolve();
      }
      window.addEventListener("blur", handleBlur);
      const timeoutId = setTimeout(() => {
        cleanup();
        reject();
      }, 3e3);
    });
  }
  var _frame = null;
  function launchUrlThroughHiddenFrame(url) {
    if (_frame == null || !_frame.isConnected) {
      _frame = document.createElement("iframe");
      _frame.style.display = "none";
      document.body.appendChild(_frame);
    }
    _frame.contentWindow.location.href = url.toString();
  }
  async function launchAssociation(associationUrl) {
    if (associationUrl.protocol === "https:") window.location.assign(associationUrl);
    else try {
      switch (getBrowser()) {
        case Browser.Firefox:
          launchUrlThroughHiddenFrame(associationUrl);
          break;
        case Browser.Other: {
          const detectionPromise = getDetectionPromise();
          window.location.assign(associationUrl);
          await detectionPromise;
          break;
        }
      }
    } catch {
      throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_WALLET_NOT_FOUND, "Found no installed wallet that supports the mobile wallet protocol.");
    }
  }
  async function startSession(associationPublicKey, associationURLBase) {
    const randomAssociationPort = getRandomAssociationPort();
    await launchAssociation(await getAssociateAndroidIntentURL(associationPublicKey, randomAssociationPort, associationURLBase));
    return randomAssociationPort;
  }
  async function startNostrSession(associationPublicKey, connectionType, relayDomain, dappNostrPubkey, associationURLBase) {
    const associationUrl = await getNostrAssociateAndroidIntentURL(associationPublicKey, connectionType, relayDomain, dappNostrPubkey, associationURLBase);
    if (connectionType == "local") await launchAssociation(associationUrl);
    return associationUrl;
  }
  var WEBSOCKET_CONNECTION_CONFIG = {
    /**
    * 300 milliseconds is a generally accepted threshold for what someone
    * would consider an acceptable response time for a user interface
    * after having performed a low-attention tapping task. We set the initial
    * interval at which we wait for the wallet to set up the websocket at
    * half this, as per the Nyquist frequency, with a progressive backoff
    * sequence from there. The total wait time is 30s, which allows for the
    * user to be presented with a disambiguation dialog, select a wallet, and
    * for the wallet app to subsequently start.
    */
    retryDelayScheduleMs: [
      150,
      150,
      200,
      500,
      500,
      750,
      750,
      1e3
    ],
    timeoutMs: 3e4
  };
  var WEBSOCKET_PROTOCOL_BINARY = "com.solana.mobilewalletadapter.v1";
  var WEBSOCKET_PROTOCOL_BASE64 = "com.solana.mobilewalletadapter.v1.base64";
  function assertSecureContext() {
    if (typeof window === "undefined" || window.isSecureContext !== true) throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SECURE_CONTEXT_REQUIRED, "The mobile wallet adapter protocol must be used in a secure context (`https`).");
  }
  function assertSecureEndpointSpecificURI(walletUriBase) {
    let url;
    try {
      url = new URL(walletUriBase);
    } catch {
      throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_FORBIDDEN_WALLET_BASE_URL, "Invalid base URL supplied by wallet");
    }
    if (url.protocol !== "https:") throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_FORBIDDEN_WALLET_BASE_URL, "Base URLs supplied by wallets must be valid `https` URLs");
  }
  function getSequenceNumberFromByteArray(byteArray) {
    return new DataView(byteArray).getUint32(0, false);
  }
  function decodeVarLong(byteArray) {
    const bytes = new Uint8Array(byteArray);
    const l = byteArray.byteLength;
    const limit = 10;
    let value = 0, offset = 0, b;
    do {
      if (offset >= l || offset > limit) throw new RangeError("Failed to decode varint");
      b = bytes[offset++];
      value |= (b & 127) << 7 * offset;
    } while (b >= 128);
    return {
      value,
      offset
    };
  }
  function getReflectorIdFromByteArray(byteArray) {
    const { value: length, offset } = decodeVarLong(byteArray);
    return new Uint8Array(byteArray.slice(offset, offset + length));
  }
  async function startScenario(config) {
    assertSecureContext();
    const associationKeypair = await generateAssociationKeypair();
    const websocketURL = `ws://localhost:${await startSession(associationKeypair.publicKey, config?.baseUri)}/solana-wallet`;
    let connectionStartTime;
    const getNextRetryDelayMs = (() => {
      const schedule = [...WEBSOCKET_CONNECTION_CONFIG.retryDelayScheduleMs];
      return () => schedule.length > 1 ? schedule.shift() : schedule[0];
    })();
    let nextJsonRpcMessageId = 1;
    let lastKnownInboundSequenceNumber = 0;
    let state = { __type: "disconnected" };
    let socket;
    let sessionEstablished = false;
    let handleForceClose;
    return {
      close: () => {
        socket.close();
        handleForceClose();
      },
      wallet: new Promise((resolve, reject) => {
        const jsonRpcResponsePromises = {};
        const handleOpen = async () => {
          if (state.__type !== "connecting") {
            console.warn(`Expected adapter state to be \`connecting\` at the moment the websocket opens. Got \`${state.__type}\`.`);
            return;
          }
          socket.removeEventListener("open", handleOpen);
          const { associationKeypair: associationKeypair2 } = state;
          const ecdhKeypair = await generateECDHKeypair();
          socket.send(await createHelloReq(ecdhKeypair.publicKey, associationKeypair2.privateKey));
          state = {
            __type: "hello_req_sent",
            associationPublicKey: associationKeypair2.publicKey,
            ecdhPrivateKey: ecdhKeypair.privateKey
          };
        };
        const handleClose = (evt) => {
          if (evt.wasClean) state = { __type: "disconnected" };
          else reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED, `The wallet session dropped unexpectedly (${evt.code}: ${evt.reason}).`, { closeEvent: evt }));
          disposeSocket();
        };
        const handleError = async (_evt) => {
          disposeSocket();
          if (Date.now() - connectionStartTime >= WEBSOCKET_CONNECTION_CONFIG.timeoutMs) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_TIMEOUT, `Failed to connect to the wallet websocket at ${websocketURL}.`));
          else {
            await new Promise((resolve2) => {
              const retryDelayMs = getNextRetryDelayMs();
              retryWaitTimeoutId = window.setTimeout(resolve2, retryDelayMs);
            });
            attemptSocketConnection();
          }
        };
        const handleMessage = async (evt) => {
          const responseBuffer = await evt.data.arrayBuffer();
          switch (state.__type) {
            case "connecting": {
              if (responseBuffer.byteLength !== 0) {
                reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encountered unexpected message while connecting"));
                return;
              }
              const ecdhKeypair = await generateECDHKeypair();
              socket.send(await createHelloReq(ecdhKeypair.publicKey, associationKeypair.privateKey));
              state = {
                __type: "hello_req_sent",
                associationPublicKey: associationKeypair.publicKey,
                ecdhPrivateKey: ecdhKeypair.privateKey
              };
              break;
            }
            case "connected":
              try {
                const sequenceNumber = getSequenceNumberFromByteArray(responseBuffer.slice(0, 4));
                if (sequenceNumber !== lastKnownInboundSequenceNumber + 1) throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encrypted message has invalid sequence number");
                lastKnownInboundSequenceNumber = sequenceNumber;
                const jsonRpcMessage = await decryptJsonRpcMessage(responseBuffer, state.sharedSecret);
                const responsePromise = jsonRpcResponsePromises[jsonRpcMessage.id];
                delete jsonRpcResponsePromises[jsonRpcMessage.id];
                responsePromise.resolve(jsonRpcMessage.result);
              } catch (e2) {
                if (e2 instanceof SolanaMobileWalletAdapterProtocolError) {
                  const responsePromise = jsonRpcResponsePromises[e2.jsonRpcMessageId];
                  delete jsonRpcResponsePromises[e2.jsonRpcMessageId];
                  responsePromise.reject(e2);
                } else throw e2;
              }
              break;
            case "hello_req_sent": {
              if (responseBuffer.byteLength === 0) {
                const ecdhKeypair = await generateECDHKeypair();
                socket.send(await createHelloReq(ecdhKeypair.publicKey, associationKeypair.privateKey));
                state = {
                  __type: "hello_req_sent",
                  associationPublicKey: associationKeypair.publicKey,
                  ecdhPrivateKey: ecdhKeypair.privateKey
                };
                break;
              }
              const sharedSecret = await parseHelloRsp(responseBuffer, state.associationPublicKey, state.ecdhPrivateKey);
              const sessionPropertiesBuffer = responseBuffer.slice(65);
              const sessionProperties = sessionPropertiesBuffer.byteLength !== 0 ? await (async () => {
                const sequenceNumber = getSequenceNumberFromByteArray(sessionPropertiesBuffer.slice(0, 4));
                if (sequenceNumber !== lastKnownInboundSequenceNumber + 1) {
                  reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encrypted message has invalid sequence number"));
                  socket.close();
                  return { protocol_version: "v1" };
                }
                lastKnownInboundSequenceNumber = sequenceNumber;
                return parseSessionProps(sessionPropertiesBuffer, sharedSecret);
              })() : { protocol_version: "legacy" };
              state = {
                __type: "connected",
                sharedSecret,
                sessionProperties
              };
              const wallet = createMobileWalletProxy(sessionProperties.protocol_version, async (method, params) => {
                const id = nextJsonRpcMessageId++;
                socket.send(await encryptJsonRpcMessage({
                  id,
                  jsonrpc: "2.0",
                  method,
                  params: params ?? {}
                }, sharedSecret));
                return new Promise((resolve2, reject2) => {
                  jsonRpcResponsePromises[id] = {
                    resolve(result) {
                      switch (method) {
                        case "authorize":
                        case "reauthorize": {
                          const { wallet_uri_base } = result;
                          if (wallet_uri_base != null) try {
                            assertSecureEndpointSpecificURI(wallet_uri_base);
                          } catch (e2) {
                            reject2(e2);
                            return;
                          }
                          break;
                        }
                      }
                      resolve2(result);
                    },
                    reject: reject2
                  };
                });
              });
              sessionEstablished = true;
              try {
                resolve(wallet);
              } catch (e2) {
                reject(e2);
              }
              break;
            }
          }
        };
        handleForceClose = () => {
          socket.removeEventListener("message", handleMessage);
          disposeSocket();
          if (!sessionEstablished) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED, `The wallet session was closed before connection.`, { closeEvent: new CloseEvent("socket was closed before connection") }));
        };
        let disposeSocket;
        let retryWaitTimeoutId;
        const attemptSocketConnection = () => {
          if (disposeSocket) disposeSocket();
          state = {
            __type: "connecting",
            associationKeypair
          };
          if (connectionStartTime === void 0) connectionStartTime = Date.now();
          socket = new WebSocket(websocketURL, [WEBSOCKET_PROTOCOL_BINARY]);
          socket.addEventListener("open", handleOpen);
          socket.addEventListener("close", handleClose);
          socket.addEventListener("error", handleError);
          socket.addEventListener("message", handleMessage);
          disposeSocket = () => {
            window.clearTimeout(retryWaitTimeoutId);
            socket.removeEventListener("open", handleOpen);
            socket.removeEventListener("close", handleClose);
            socket.removeEventListener("error", handleError);
            socket.removeEventListener("message", handleMessage);
          };
        };
        attemptSocketConnection();
      })
    };
  }
  async function startRemoteScenario(config) {
    assertSecureContext();
    const associationKeypair = await generateAssociationKeypair();
    const websocketURL = `wss://${config?.remoteHostAuthority}/reflect`;
    let connectionStartTime;
    const getNextRetryDelayMs = (() => {
      const schedule = [...WEBSOCKET_CONNECTION_CONFIG.retryDelayScheduleMs];
      return () => schedule.length > 1 ? schedule.shift() : schedule[0];
    })();
    let nextJsonRpcMessageId = 1;
    let lastKnownInboundSequenceNumber = 0;
    let encoding;
    let state = { __type: "disconnected" };
    let socket;
    let disposeSocket;
    const decodeBytes = async (evt) => {
      if (encoding == "base64") {
        const message = await evt.data;
        return toUint8Array$1(message).buffer;
      } else return await evt.data.arrayBuffer();
    };
    const associationUrl = await new Promise((resolve, reject) => {
      const handleOpen = async () => {
        if (state.__type !== "connecting") {
          console.warn(`Expected adapter state to be \`connecting\` at the moment the websocket opens. Got \`${state.__type}\`.`);
          return;
        }
        if (socket.protocol.includes(WEBSOCKET_PROTOCOL_BASE64)) encoding = "base64";
        else encoding = "binary";
        socket.removeEventListener("open", handleOpen);
      };
      const handleClose2 = (evt) => {
        if (evt.wasClean) state = { __type: "disconnected" };
        else reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED, `The wallet session dropped unexpectedly (${evt.code}: ${evt.reason}).`, { closeEvent: evt }));
        disposeSocket();
      };
      const handleError = async (_evt) => {
        disposeSocket();
        if (Date.now() - connectionStartTime >= WEBSOCKET_CONNECTION_CONFIG.timeoutMs) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_TIMEOUT, `Failed to connect to the wallet websocket at ${websocketURL}.`));
        else {
          await new Promise((resolve2) => {
            const retryDelayMs = getNextRetryDelayMs();
            retryWaitTimeoutId = window.setTimeout(resolve2, retryDelayMs);
          });
          attemptSocketConnection();
        }
      };
      const handleReflectorIdMessage = async (evt) => {
        const responseBuffer = await decodeBytes(evt);
        if (state.__type === "connecting") {
          if (responseBuffer.byteLength == 0) {
            reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encountered unexpected message while connecting"));
            socket.close();
            return;
          }
          const reflectorId = getReflectorIdFromByteArray(responseBuffer);
          state = {
            __type: "reflector_id_received",
            reflectorId
          };
          const associationUrl2 = await getRemoteAssociateAndroidIntentURL(associationKeypair.publicKey, config.remoteHostAuthority, reflectorId, config?.baseUri);
          socket.removeEventListener("message", handleReflectorIdMessage);
          resolve(associationUrl2);
        }
      };
      let retryWaitTimeoutId;
      const attemptSocketConnection = () => {
        if (disposeSocket) disposeSocket();
        state = {
          __type: "connecting",
          associationKeypair
        };
        if (connectionStartTime === void 0) connectionStartTime = Date.now();
        socket = new WebSocket(websocketURL, [WEBSOCKET_PROTOCOL_BINARY, WEBSOCKET_PROTOCOL_BASE64]);
        socket.addEventListener("open", handleOpen);
        socket.addEventListener("close", handleClose2);
        socket.addEventListener("error", handleError);
        socket.addEventListener("message", handleReflectorIdMessage);
        disposeSocket = () => {
          window.clearTimeout(retryWaitTimeoutId);
          socket.removeEventListener("open", handleOpen);
          socket.removeEventListener("close", handleClose2);
          socket.removeEventListener("error", handleError);
          socket.removeEventListener("message", handleReflectorIdMessage);
        };
      };
      attemptSocketConnection();
    });
    let sessionEstablished = false;
    let handleClose;
    return {
      associationUrl,
      close: () => {
        socket.close();
        handleClose();
      },
      wallet: new Promise((resolve, reject) => {
        const jsonRpcResponsePromises = {};
        const handleMessage = async (evt) => {
          const responseBuffer = await decodeBytes(evt);
          switch (state.__type) {
            case "reflector_id_received": {
              if (responseBuffer.byteLength !== 0) {
                reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encountered unexpected message while awaiting reflection"));
                socket.close();
                return;
              }
              const ecdhKeypair = await generateECDHKeypair();
              const binaryMsg = await createHelloReq(ecdhKeypair.publicKey, associationKeypair.privateKey);
              if (encoding == "base64") socket.send(fromUint8Array$1(binaryMsg));
              else socket.send(binaryMsg);
              state = {
                __type: "hello_req_sent",
                associationPublicKey: associationKeypair.publicKey,
                ecdhPrivateKey: ecdhKeypair.privateKey
              };
              break;
            }
            case "connected":
              try {
                const sequenceNumber = getSequenceNumberFromByteArray(responseBuffer.slice(0, 4));
                if (sequenceNumber !== lastKnownInboundSequenceNumber + 1) throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encrypted message has invalid sequence number");
                lastKnownInboundSequenceNumber = sequenceNumber;
                const jsonRpcMessage = await decryptJsonRpcMessage(responseBuffer, state.sharedSecret);
                const responsePromise = jsonRpcResponsePromises[jsonRpcMessage.id];
                delete jsonRpcResponsePromises[jsonRpcMessage.id];
                responsePromise.resolve(jsonRpcMessage.result);
              } catch (e2) {
                if (e2 instanceof SolanaMobileWalletAdapterProtocolError) {
                  const responsePromise = jsonRpcResponsePromises[e2.jsonRpcMessageId];
                  delete jsonRpcResponsePromises[e2.jsonRpcMessageId];
                  responsePromise.reject(e2);
                } else throw e2;
              }
              break;
            case "hello_req_sent": {
              const sharedSecret = await parseHelloRsp(responseBuffer, state.associationPublicKey, state.ecdhPrivateKey);
              const sessionPropertiesBuffer = responseBuffer.slice(65);
              const sessionProperties = sessionPropertiesBuffer.byteLength !== 0 ? await (async () => {
                const sequenceNumber = getSequenceNumberFromByteArray(sessionPropertiesBuffer.slice(0, 4));
                if (sequenceNumber !== lastKnownInboundSequenceNumber + 1) {
                  reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encrypted message has invalid sequence number"));
                  socket.close();
                  return { protocol_version: "v1" };
                }
                lastKnownInboundSequenceNumber = sequenceNumber;
                return parseSessionProps(sessionPropertiesBuffer, sharedSecret);
              })() : { protocol_version: "legacy" };
              state = {
                __type: "connected",
                sharedSecret,
                sessionProperties
              };
              const wallet = createMobileWalletProxy(sessionProperties.protocol_version, async (method, params) => {
                const id = nextJsonRpcMessageId++;
                const binaryMsg = await encryptJsonRpcMessage({
                  id,
                  jsonrpc: "2.0",
                  method,
                  params: params ?? {}
                }, sharedSecret);
                if (encoding == "base64") socket.send(fromUint8Array$1(binaryMsg));
                else socket.send(binaryMsg);
                return new Promise((resolve2, reject2) => {
                  jsonRpcResponsePromises[id] = {
                    resolve(result) {
                      switch (method) {
                        case "authorize":
                        case "reauthorize": {
                          const { wallet_uri_base } = result;
                          if (wallet_uri_base != null) try {
                            assertSecureEndpointSpecificURI(wallet_uri_base);
                          } catch (e2) {
                            reject2(e2);
                            return;
                          }
                          break;
                        }
                      }
                      resolve2(result);
                    },
                    reject: reject2
                  };
                });
              });
              sessionEstablished = true;
              try {
                resolve(wallet);
              } catch (e2) {
                reject(e2);
              }
              break;
            }
          }
        };
        socket.addEventListener("message", handleMessage);
        handleClose = () => {
          socket.removeEventListener("message", handleMessage);
          disposeSocket();
          if (!sessionEstablished) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED, `The wallet session was closed before connection.`, { closeEvent: new CloseEvent("socket was closed before connection") }));
        };
      })
    };
  }
  async function startNostrScenario(config) {
    assertSecureContext();
    const associationKeypair = await generateAssociationKeypair();
    const { privateKey: dappNostrPrivateKey, publicKey: dappNostrPubkey } = generateNostrKeypair();
    const associationUrl = await startNostrSession(associationKeypair.publicKey, config.connectionType, config.relayDomain, dappNostrPubkey, config.baseUri);
    const sessionIdentifier = await deriveSessionIdentifier(associationKeypair.publicKey);
    const subscriptionId = crypto.randomUUID();
    const webSocketURL = `wss://${config.relayDomain}`;
    const connectionStartTime = Date.now();
    const getNextRetryDelayMs = (() => {
      const schedule = [...WEBSOCKET_CONNECTION_CONFIG.retryDelayScheduleMs];
      return () => schedule.length > 1 ? schedule.shift() : schedule[0];
    })();
    let nextJsonRpcMessageId = 1;
    let lastKnownInboundSequenceNumber = 0;
    let state = { __type: "disconnected" };
    let socket;
    let sessionEstablished = false;
    let handleForceClose;
    const sendNostrEvent = (content, walletPubkey) => {
      const event = createNostrEvent(NOSTR_EVENT_KIND_MWA, content, [["d", sessionIdentifier], ["p", walletPubkey]], dappNostrPrivateKey);
      socket.send(JSON.stringify(["EVENT", event]));
    };
    const doClose = () => {
      if (state.__type == "connected" || state.__type == "hello_req_sent") {
        const event = createNostrEvent(NOSTR_EVENT_KIND_MWA, "", [
          ["d", sessionIdentifier],
          ["p", state.walletNostrPubkey],
          ["msg", "SESSION_END"]
        ], dappNostrPrivateKey);
        socket.send(JSON.stringify(["EVENT", event]));
      }
      socket.close();
    };
    const scenario = {
      close: () => {
        doClose();
        handleForceClose();
      },
      wallet: new Promise((resolve, reject) => {
        const jsonRpcResponsePromises = {};
        const handleOpen = async () => {
          if (state.__type !== "connecting") {
            console.warn(`Expected adapter state to be \`connecting\` at the moment the websocket opens. Got \`${state.__type}\`.`);
            return;
          }
          socket.removeEventListener("open", handleOpen);
          socket.send(JSON.stringify([
            "REQ",
            subscriptionId,
            {
              kinds: [NOSTR_EVENT_KIND_MWA],
              "#d": [sessionIdentifier]
            }
          ]));
          state = {
            __type: "subscribed",
            dappNostrPrivateKey,
            dappNostrPubkey,
            sessionIdentifier
          };
        };
        const handleClose = (evt) => {
          if (evt.wasClean) state = { __type: "disconnected" };
          else reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED, `The Nostr subscription dropped unexpectedly (${evt.code}: ${evt.reason}).`, { closeEvent: evt }));
          disposeSocket();
        };
        const handleError = async () => {
          disposeSocket();
          if (Date.now() - connectionStartTime >= WEBSOCKET_CONNECTION_CONFIG.timeoutMs) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_TIMEOUT, `Failed to connect to the Nostr relay at ${config.relayDomain}.`));
          else {
            await new Promise((resolve2) => {
              const retryDelayMs = getNextRetryDelayMs();
              retryWaitTimeoutId = window.setTimeout(resolve2, retryDelayMs);
            });
            attemptSocketConnection();
          }
        };
        const handleMessage = async (evt) => {
          let msg;
          try {
            msg = JSON.parse(evt.data);
            if (!Array.isArray(msg)) throw new Error();
          } catch {
            reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Invalid Nostr message received: " + evt.data));
            doClose();
            return;
          }
          const type = msg[0];
          if (type === "CLOSED") disposeSocket();
          else if (type === "EVENT") {
            const event = msg[2];
            if (!event || !verifyNostrEvent(event)) return;
            switch (state.__type) {
              case "subscribed": {
                if (event.content.length !== 0) {
                  reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encountered unexpected message while awaiting reflection"));
                  doClose();
                  return;
                }
                const walletNostrPubkey = event.pubkey;
                const ecdhKeypair = await generateECDHKeypair();
                const helloReq = await createHelloReq(ecdhKeypair.publicKey, associationKeypair.privateKey);
                const base64Content = fromUint8Array$1(helloReq);
                sendNostrEvent(base64Content, walletNostrPubkey);
                state = {
                  __type: "hello_req_sent",
                  associationPublicKey: associationKeypair.publicKey,
                  ecdhPrivateKey: ecdhKeypair.privateKey,
                  walletNostrPubkey
                };
                break;
              }
              case "hello_req_sent": {
                if (event.pubkey !== state.walletNostrPubkey) return;
                if (event.content === "") return;
                const responseBuffer = toUint8Array$1(event.content).buffer;
                const sharedSecret = await parseHelloRsp(responseBuffer, state.associationPublicKey, state.ecdhPrivateKey);
                const sessionPropertiesBuffer = responseBuffer.slice(65);
                const sessionProperties = sessionPropertiesBuffer.byteLength !== 0 ? await (async () => {
                  const sequenceNumber = getSequenceNumberFromByteArray(sessionPropertiesBuffer.slice(0, 4));
                  if (sequenceNumber !== lastKnownInboundSequenceNumber + 1) {
                    reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encrypted message has invalid sequence number"));
                    doClose();
                    return { protocol_version: "v1" };
                  }
                  lastKnownInboundSequenceNumber = sequenceNumber;
                  return parseSessionProps(sessionPropertiesBuffer, sharedSecret);
                })() : { protocol_version: "legacy" };
                state = {
                  __type: "connected",
                  sharedSecret,
                  sessionProperties,
                  walletNostrPubkey: state.walletNostrPubkey
                };
                const wallet = createMobileWalletProxy(sessionProperties.protocol_version, async (method, params) => {
                  const id = nextJsonRpcMessageId++;
                  const binaryMsg = await encryptJsonRpcMessage({
                    id,
                    jsonrpc: "2.0",
                    method,
                    params: params ?? {}
                  }, sharedSecret);
                  sendNostrEvent(fromUint8Array$1(binaryMsg), state.walletNostrPubkey);
                  return new Promise((resolve2, reject2) => {
                    jsonRpcResponsePromises[id] = {
                      resolve(result) {
                        switch (method) {
                          case "authorize":
                          case "reauthorize": {
                            const { wallet_uri_base } = result;
                            if (wallet_uri_base != null) try {
                              assertSecureEndpointSpecificURI(wallet_uri_base);
                            } catch (e2) {
                              reject2(e2);
                              return;
                            }
                            break;
                          }
                        }
                        resolve2(result);
                      },
                      reject: reject2
                    };
                  });
                });
                sessionEstablished = true;
                try {
                  resolve(wallet);
                } catch (e2) {
                  reject(e2);
                }
                break;
              }
              case "connected":
                if (event.pubkey !== state.walletNostrPubkey) return;
                if (event.content === "") return;
                try {
                  const responseBuffer = toUint8Array$1(event.content).buffer;
                  const sequenceNumber = getSequenceNumberFromByteArray(responseBuffer.slice(0, 4));
                  if (sequenceNumber !== lastKnownInboundSequenceNumber + 1) throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ILLEGAL_TRANSPORT_STATE, "Encrypted message has invalid sequence number");
                  lastKnownInboundSequenceNumber = sequenceNumber;
                  const jsonRpcMessage = await decryptJsonRpcMessage(responseBuffer, state.sharedSecret);
                  const responsePromise = jsonRpcResponsePromises[jsonRpcMessage.id];
                  delete jsonRpcResponsePromises[jsonRpcMessage.id];
                  responsePromise.resolve(jsonRpcMessage.result);
                } catch (e2) {
                  if (e2 instanceof SolanaMobileWalletAdapterProtocolError) {
                    const responsePromise = jsonRpcResponsePromises[e2.jsonRpcMessageId];
                    delete jsonRpcResponsePromises[e2.jsonRpcMessageId];
                    responsePromise.reject(e2);
                  } else throw e2;
                }
            }
          }
        };
        handleForceClose = () => {
          socket.removeEventListener("message", handleMessage);
          disposeSocket();
          if (!sessionEstablished) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED, `The wallet session was closed before connection.`, { closeEvent: new CloseEvent("socket was closed before connection") }));
        };
        let disposeSocket;
        let retryWaitTimeoutId;
        const attemptSocketConnection = () => {
          if (disposeSocket) disposeSocket();
          state = {
            __type: "connecting",
            associationKeypair
          };
          socket = new WebSocket(webSocketURL);
          socket.addEventListener("open", handleOpen);
          socket.addEventListener("close", handleClose);
          socket.addEventListener("error", handleError);
          socket.addEventListener("message", handleMessage);
          disposeSocket = () => {
            window.clearTimeout(retryWaitTimeoutId);
            socket.removeEventListener("open", handleOpen);
            socket.removeEventListener("close", handleClose);
            socket.removeEventListener("error", handleError);
            socket.removeEventListener("message", handleMessage);
          };
        };
        attemptSocketConnection();
      })
    };
    if (config.connectionType == "local") return scenario;
    else return {
      ...scenario,
      associationUrl
    };
  }

  // node_modules/@solana/wallet-standard-features/lib/esm/signAndSendTransaction.js
  var SolanaSignAndSendTransaction = "solana:signAndSendTransaction";

  // node_modules/@solana/wallet-standard-features/lib/esm/signIn.js
  var SolanaSignIn = "solana:signIn";

  // node_modules/@solana/wallet-standard-features/lib/esm/signMessage.js
  var SolanaSignMessage = "solana:signMessage";

  // node_modules/@solana/wallet-standard-features/lib/esm/signTransaction.js
  var SolanaSignTransaction = "solana:signTransaction";

  // node_modules/@wallet-standard/features/lib/esm/connect.js
  var StandardConnect = "standard:connect";

  // node_modules/@wallet-standard/features/lib/esm/disconnect.js
  var StandardDisconnect = "standard:disconnect";

  // node_modules/@wallet-standard/features/lib/esm/events.js
  var StandardEvents = "standard:events";

  // node_modules/@solana-mobile/wallet-standard-mobile/lib/esm/index.browser.js
  var import_qrcode = __toESM(require_browser(), 1);
  var CACHE_KEY = "SolanaMobileWalletAdapterDefaultAuthorizationCache";
  function createDefaultAuthorizationCache() {
    let storage;
    try {
      storage = window.localStorage;
    } catch {
    }
    return {
      async clear() {
        if (!storage) return;
        try {
          storage.removeItem(CACHE_KEY);
        } catch {
        }
      },
      async get() {
        if (!storage) return;
        try {
          const parsed = JSON.parse(storage.getItem(CACHE_KEY));
          if (parsed && parsed.accounts) {
            const parsedAccounts = parsed.accounts.map((account) => {
              return {
                ...account,
                publicKey: "publicKey" in account ? new Uint8Array(Object.values(account.publicKey)) : base58ToUint8Array(account.address)
              };
            });
            return {
              ...parsed,
              accounts: parsedAccounts
            };
          } else return parsed || void 0;
        } catch {
        }
      },
      async set(authorization) {
        if (!storage) return;
        try {
          storage.setItem(CACHE_KEY, JSON.stringify(authorization));
        } catch {
        }
      }
    };
  }
  function createDefaultChainSelector() {
    return { async select(chains) {
      if (chains.length === 1) return chains[0];
      else if (chains.includes(SOLANA_MAINNET_CHAIN)) return SOLANA_MAINNET_CHAIN;
      else return chains[0];
    } };
  }
  var modalHtml$1 = `
<div class="mobile-wallet-adapter-embedded-modal-container" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div data-modal-close style="position: absolute; width: 100%; height: 100%;"></div>
	<div class="mobile-wallet-adapter-embedded-modal-card">
		<div>
			<button data-modal-close class="mobile-wallet-adapter-embedded-modal-close">
				<svg width="14" height="14">
					<path d="M 6.7125,8.3036995 1.9082,13.108199 c -0.2113,0.2112 -0.4765,0.3168 -0.7957,0.3168 -0.3192,0 -0.5844,-0.1056 -0.7958,-0.3168 C 0.1056,12.896899 0,12.631699 0,12.312499 c 0,-0.3192 0.1056,-0.5844 0.3167,-0.7958 L 5.1212,6.7124995 0.3167,1.9082 C 0.1056,1.6969 0,1.4317 0,1.1125 0,0.7933 0.1056,0.5281 0.3167,0.3167 0.5281,0.1056 0.7933,0 1.1125,0 1.4317,0 1.6969,0.1056 1.9082,0.3167 L 6.7125,5.1212 11.5167,0.3167 C 11.7281,0.1056 11.9933,0 12.3125,0 c 0.3192,0 0.5844,0.1056 0.7957,0.3167 0.2112,0.2114 0.3168,0.4766 0.3168,0.7958 0,0.3192 -0.1056,0.5844 -0.3168,0.7957 L 8.3037001,6.7124995 13.1082,11.516699 c 0.2112,0.2114 0.3168,0.4766 0.3168,0.7958 0,0.3192 -0.1056,0.5844 -0.3168,0.7957 -0.2113,0.2112 -0.4765,0.3168 -0.7957,0.3168 -0.3192,0 -0.5844,-0.1056 -0.7958,-0.3168 z" />
				</svg>
			</button>
		</div>
		<div class="mobile-wallet-adapter-embedded-modal-content"></div>
	</div>
</div>
`;
  var css$6 = `
.mobile-wallet-adapter-embedded-modal-container {
    display: flex; /* Use flexbox to center content */
    justify-content: center; /* Center horizontally */
    align-items: center; /* Center vertically */
    position: fixed; /* Stay in place */
    z-index: 2147483647; /* Sit on top */
    left: 0;
    top: 0;
    width: 100%; /* Full width */
    height: 100%; /* Full height */
    background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
    overflow-y: auto; /* enable scrolling */
}

.mobile-wallet-adapter-embedded-modal-card {
    display: flex;
    flex-direction: column;
    margin: auto 20px;
    max-width: 780px;
    padding: 20px;
    border-radius: 24px;
    background: #ffffff;
    font-family: "Inter Tight", "PT Sans", Calibri, sans-serif;
    transform: translateY(-200%);
    animation: slide-in 0.5s forwards;
}

@keyframes slide-in {
    100% { transform: translateY(0%); }
}

.mobile-wallet-adapter-embedded-modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    cursor: pointer;
    background: #e4e9e9;
    border: none;
    border-radius: 50%;
}

.mobile-wallet-adapter-embedded-modal-close:focus-visible {
    outline-color: red;
}

.mobile-wallet-adapter-embedded-modal-close svg {
    fill: #546266;
    transition: fill 200ms ease 0s;
}

.mobile-wallet-adapter-embedded-modal-close:hover svg {
    fill: #fff;
}
`;
  var fonts = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
`;
  var _root, _eventListeners, _listenersAttached, _EmbeddedModal_instances, injectHTML_fn, attachEventListeners_fn, removeEventListeners_fn, _handleKeyDown, _a;
  var EmbeddedModal = (_a = class {
    constructor() {
      __privateAdd(this, _EmbeddedModal_instances);
      __privateAdd(this, _root, null);
      __privateAdd(this, _eventListeners, {});
      __privateAdd(this, _listenersAttached, false);
      __publicField(this, "dom", null);
      __publicField(this, "open", () => {
        console.debug("Modal open");
        __privateMethod(this, _EmbeddedModal_instances, attachEventListeners_fn).call(this);
        if (__privateGet(this, _root)) __privateGet(this, _root).style.display = "flex";
      });
      __publicField(this, "close", (event = void 0) => {
        console.debug("Modal close");
        __privateMethod(this, _EmbeddedModal_instances, removeEventListeners_fn).call(this);
        if (__privateGet(this, _root)) __privateGet(this, _root).style.display = "none";
        __privateGet(this, _eventListeners)["close"]?.forEach((listener) => listener(event));
      });
      __privateAdd(this, _handleKeyDown, (event) => {
        if (event.key === "Escape") this.close(event);
      });
      this.init = this.init.bind(this);
      __privateSet(this, _root, document.getElementById("mobile-wallet-adapter-embedded-root-ui"));
    }
    async init() {
      console.log("Injecting modal");
      __privateMethod(this, _EmbeddedModal_instances, injectHTML_fn).call(this);
    }
    addEventListener(event, listener) {
      __privateGet(this, _eventListeners)[event]?.push(listener) || (__privateGet(this, _eventListeners)[event] = [listener]);
      return () => this.removeEventListener(event, listener);
    }
    removeEventListener(event, listener) {
      __privateGet(this, _eventListeners)[event] = __privateGet(this, _eventListeners)[event]?.filter((existingListener) => listener !== existingListener);
    }
  }, _root = new WeakMap(), _eventListeners = new WeakMap(), _listenersAttached = new WeakMap(), _EmbeddedModal_instances = new WeakSet(), injectHTML_fn = function() {
    if (document.getElementById("mobile-wallet-adapter-embedded-root-ui")) {
      if (!__privateGet(this, _root)) __privateSet(this, _root, document.getElementById("mobile-wallet-adapter-embedded-root-ui"));
      return;
    }
    __privateSet(this, _root, document.createElement("div"));
    __privateGet(this, _root).id = "mobile-wallet-adapter-embedded-root-ui";
    __privateGet(this, _root).innerHTML = modalHtml$1;
    __privateGet(this, _root).style.display = "none";
    const content = __privateGet(this, _root).querySelector(".mobile-wallet-adapter-embedded-modal-content");
    if (content) content.innerHTML = this.contentHtml;
    const styles = document.createElement("style");
    styles.id = "mobile-wallet-adapter-embedded-modal-styles";
    styles.textContent = css$6 + this.contentStyles;
    const host = document.createElement("div");
    host.innerHTML = fonts;
    this.dom = host.attachShadow({ mode: "closed" });
    this.dom.appendChild(styles);
    this.dom.appendChild(__privateGet(this, _root));
    document.body.appendChild(host);
  }, attachEventListeners_fn = function() {
    if (!__privateGet(this, _root) || __privateGet(this, _listenersAttached)) return;
    [...__privateGet(this, _root).querySelectorAll("[data-modal-close]")].forEach((closer) => closer?.addEventListener("click", this.close));
    window.addEventListener("load", this.close);
    document.addEventListener("keydown", __privateGet(this, _handleKeyDown));
    __privateSet(this, _listenersAttached, true);
  }, removeEventListeners_fn = function() {
    if (!__privateGet(this, _listenersAttached)) return;
    window.removeEventListener("load", this.close);
    document.removeEventListener("keydown", __privateGet(this, _handleKeyDown));
    if (!__privateGet(this, _root)) return;
    [...__privateGet(this, _root).querySelectorAll("[data-modal-close]")].forEach((closer) => closer?.removeEventListener("click", this.close));
    __privateSet(this, _listenersAttached, false);
  }, _handleKeyDown = new WeakMap(), _a);
  var _LocalConnectionModal_instances, prepareLaunchAction_fn, _a2;
  var LocalConnectionModal = (_a2 = class extends EmbeddedModal {
    constructor() {
      super(...arguments);
      __privateAdd(this, _LocalConnectionModal_instances);
      __publicField(this, "contentStyles", css$4);
      __publicField(this, "contentHtml", ErrorDialogHtml$2);
    }
    initWithCallback(callback) {
      super.init();
      __privateMethod(this, _LocalConnectionModal_instances, prepareLaunchAction_fn).call(this, callback);
    }
  }, _LocalConnectionModal_instances = new WeakSet(), prepareLaunchAction_fn = function(callback) {
    const launchButton = this.dom?.getElementById("mobile-wallet-adapter-launch-action");
    const listener = async () => {
      launchButton?.removeEventListener("click", listener);
      this.close();
      callback();
    };
    launchButton?.addEventListener("click", listener);
  }, _a2);
  var ErrorDialogHtml$2 = `
<svg class="mobile-wallet-adapter-embedded-modal-launch-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.6 48C7.2 48 0 40.8 0 26.4V21.6C0 7.2 7.2 0 21.6 0H26.4C40.8 0 48 7.2 48 21.6V26.4C48 40.8 40.8 48 26.4 48H21.6Z" fill="#15994E"/>
    <mask id="mask0_189_522" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="8" y="8" width="32" height="32">
        <rect x="8" y="8" width="32" height="32" fill="#D9D9D9"/>
    </mask>
    <g mask="url(#mask0_189_522)">
        <mask id="mask1_189_522" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="8" y="8" width="32" height="32">
            <rect x="8" y="8" width="32" height="32" fill="#D9D9D9"/>
        </mask>
        <g mask="url(#mask1_189_522)">
            <path d="M22.1092 26.1208L19.4498 23.4615C19.1736 23.1851 18.8253 23.0468 18.4048 23.0468C17.9846 23.0468 17.6363 23.1851 17.3598 23.4615C17.0836 23.7377 16.9468 24.0861 16.9495 24.5065C16.9522 24.9267 17.0916 25.275 17.3678 25.5512L21.0405 29.2238C21.3463 29.5276 21.7031 29.6795 22.1108 29.6795C22.5184 29.6795 22.8742 29.5276 23.1782 29.2238L30.5918 21.8098C30.8683 21.5336 31.0065 21.1867 31.0065 20.7692C31.0065 20.3514 30.8683 20.0044 30.5918 19.7282C30.3156 19.4517 29.9673 19.3135 29.5468 19.3135C29.1266 19.3135 28.7784 19.4517 28.5022 19.7282L22.1092 26.1208ZM23.9998 37.6042C22.113 37.6042 20.3425 37.2473 18.6885 36.5335C17.0343 35.8197 15.5954 34.8512 14.3718 33.6278C13.1485 32.4043 12.18 30.9654 11.4662 29.3112C10.7524 27.6572 10.3955 25.8867 10.3955 23.9998C10.3955 22.113 10.7524 20.3425 11.4662 18.6885C12.18 17.0343 13.1485 15.5954 14.3718 14.3718C15.5954 13.1485 17.0343 12.18 18.6885 11.4662C20.3425 10.7524 22.113 10.3955 23.9998 10.3955C25.8867 10.3955 27.6572 10.7524 29.3112 11.4662C30.9654 12.18 32.4043 13.1485 33.6278 14.3718C34.8512 15.5954 35.8197 17.0343 36.5335 18.6885C37.2473 20.3425 37.6042 22.113 37.6042 23.9998C37.6042 25.8867 37.2473 27.6572 36.5335 29.3112C35.8197 30.9654 34.8512 32.4043 33.6278 33.6278C32.4043 34.8512 30.9654 35.8197 29.3112 36.5335C27.6572 37.2473 25.8867 37.6042 23.9998 37.6042Z" fill="white"/>
        </g>
    </g>
</svg>
<div class="mobile-wallet-adapter-embedded-modal-title">Ready to connect!</div>
<div>
    <button data-modal-action id="mobile-wallet-adapter-launch-action" class="mobile-wallet-adapter-embedded-modal-launch-action">
        Connect Wallet
    </button>
</div>
`;
  var css$4 = `
.mobile-wallet-adapter-embedded-modal-close {
    display: none;
}
.mobile-wallet-adapter-embedded-modal-content {
    text-align: center;
    min-width: 300px;
}
.mobile-wallet-adapter-embedded-modal-launch-icon {
    margin-top: 24px;
}
.mobile-wallet-adapter-embedded-modal-title {
    margin: 18px 100px 30px 100px;
    color: #000000;
    font-size: 2.75em;
    font-weight: 600;
}
.mobile-wallet-adapter-embedded-modal-launch-action {
    display: block;
    width: 100%;
    height: 56px;
    font-size: 1.25em;
    background: #000000;
    color: #FFFFFF;
    border-radius: 18px;
}
/* Smaller screens */
@media all and (max-width: 600px) {
    .mobile-wallet-adapter-embedded-modal-title {
        font-size: 1.5em;
        margin-right: 12px;
        margin-left: 12px;
    }
}
`;
  var _LoopbackPermissionBlockedModal_instances, prepareLaunchAction_fn2, _a3;
  var LoopbackPermissionBlockedModal = (_a3 = class extends EmbeddedModal {
    constructor() {
      super(...arguments);
      __privateAdd(this, _LoopbackPermissionBlockedModal_instances);
      __publicField(this, "contentStyles", css$3);
    }
    get contentHtml() {
      const instructions = getIsPwaLaunchedAsApp() ? "Long press the app icon on your home screen to open site settings" : "Tap the lock or settings icon in the address bar to open site settings";
      return ErrorDialogHtml$1.replace("{{PERMISSION_INSTRUCTION_DETAIL}}", instructions);
    }
    async init() {
      super.init();
      __privateMethod(this, _LoopbackPermissionBlockedModal_instances, prepareLaunchAction_fn2).call(this);
    }
  }, _LoopbackPermissionBlockedModal_instances = new WeakSet(), prepareLaunchAction_fn2 = function() {
    const launchButton = this.dom?.getElementById("mobile-wallet-adapter-launch-action");
    const listener = async (event) => {
      launchButton?.removeEventListener("click", listener);
      this.close(event);
    };
    launchButton?.addEventListener("click", listener);
  }, _a3);
  var ErrorDialogHtml$1 = `
<div class="mobile-wallet-adapter-embedded-modal-header">
    Local Wallet Connection
</div>
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.6 48C7.2 48 0 40.8 0 26.4V21.6C0 7.2 7.2 0 21.6 0H26.4C40.8 0 48 7.2 48 21.6V26.4C48 40.8 40.8 48 26.4 48H21.6Z" fill="#ED1515"/>
    <mask id="mask0_147_1364" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="8" y="8" width="32" height="32">
        <rect x="8" y="8" width="32" height="32" fill="#D9D9D9"/>
    </mask>
    <g mask="url(#mask0_147_1364)">
        <path d="M20.1398 36.2705C19.7363 36.2705 19.3508 36.1945 18.9835 36.0425C18.6162 35.8907 18.2916 35.674 18.0098 35.3922L12.6072 29.9895C12.3254 29.7077 12.1086 29.3832 11.9568 29.0158C11.8048 28.6485 11.7288 28.2631 11.7288 27.8595V20.1395C11.7288 19.736 11.8048 19.3505 11.9568 18.9832C12.1086 18.6158 12.3254 18.2913 12.6072 18.0095L18.0098 12.6068C18.2916 12.3251 18.6162 12.1083 18.9835 11.9565C19.3508 11.8045 19.7363 11.7285 20.1398 11.7285H27.8598C28.2634 11.7285 28.6488 11.8045 29.0162 11.9565C29.3835 12.1083 29.708 12.3251 29.9898 12.6068L35.3925 18.0095C35.6743 18.2913 35.891 18.6158 36.0428 18.9832C36.1948 19.3505 36.2708 19.736 36.2708 20.1395V27.8595C36.2708 28.2631 36.1948 28.6485 36.0428 29.0158C35.891 29.3832 35.6743 29.7077 35.3925 29.9895L29.9898 35.3922C29.708 35.674 29.3835 35.8907 29.0162 36.0425C28.6488 36.1945 28.2634 36.2705 27.8598 36.2705H20.1398ZM20.1732 33.2372H27.8265L33.2375 27.8262V20.1728L27.8265 14.7618H20.1732L14.7622 20.1728V27.8262L20.1732 33.2372ZM23.9998 25.9538L26.7868 28.7408C27.0473 29.0013 27.3729 29.1302 27.7638 29.1275C28.1549 29.1248 28.4807 28.9933 28.7412 28.7328C29.0016 28.4724 29.1318 28.1466 29.1318 27.7555C29.1318 27.3646 29.0016 27.039 28.7412 26.7785L25.9542 23.9995L28.7412 21.2125C29.0016 20.9521 29.1318 20.6264 29.1318 20.2355C29.1318 19.8444 29.0016 19.5186 28.7412 19.2582C28.4807 18.9977 28.1549 18.8675 27.7638 18.8675C27.3729 18.8675 27.0473 18.9977 26.7868 19.2582L23.9998 22.0452L21.2128 19.2582C20.9524 18.9977 20.628 18.8675 20.2398 18.8675C19.8514 18.8675 19.5269 18.9977 19.2665 19.2582C19.006 19.5186 18.8758 19.8444 18.8758 20.2355C18.8758 20.6264 19.006 20.9521 19.2665 21.2125L22.0455 23.9995L19.2585 26.7865C18.998 27.047 18.8692 27.3713 18.8718 27.7595C18.8745 28.148 19.006 28.4724 19.2665 28.7328C19.5269 28.9933 19.8527 29.1235 20.2438 29.1235C20.6347 29.1235 20.9604 28.9933 21.2208 28.7328L23.9998 25.9538Z" fill="black"/>
    </g>
</svg>
<div class="mobile-wallet-adapter-embedded-modal-title">
    Your wallet connection is blocked
</div>
<div id="mobile-wallet-adapter-local-launch-message" class="mobile-wallet-adapter-embedded-modal-subtitle">
    Visit site settings in the address bar and allow "Apps on Device".
</div>

<div class="mobile-wallet-adapter-embedded-modal-divider"><hr></div>
<div class="mobile-wallet-adapter-embedded-modal-footer">
    <div class="mobile-wallet-adapter-embedded-modal-details">
        <!-- Clickable header (label associated with the checkbox) -->
      	<label for="collapsible-1" class="mobile-wallet-adapter-embedded-modal-details-collapsible-header">
            <!-- Hidden checkbox to track state -->
            <input type="checkbox" id="collapsible-1" class="mobile-wallet-adapter-embedded-modal-details-collapsible-input">
            <span class="mobile-wallet-adapter-embedded-modal-details-collapsible-header-label">
              See details
            </span>
            <svg class="mobile-wallet-adapter-embedded-modal-details-collapsible-header-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <mask id="mask0_147_1382" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
                <rect width="24" height="24" fill="#D9D9D9"/>
              </mask>
              <g mask="url(#mask0_147_1382)">
                <path d="M11.9999 17.0811C11.8506 17.0811 11.7087 17.0563 11.5741 17.0067C11.4395 16.957 11.3162 16.8762 11.2042 16.7643L6.57924 12.1393C6.36801 11.9281 6.26656 11.667 6.27489 11.3561C6.28322 11.0453 6.39301 10.7842 6.60424 10.573C6.81547 10.3618 7.08069 10.2561 7.39989 10.2561C7.71909 10.2561 7.9843 10.3618 8.19554 10.573L11.9999 14.3773L15.8292 10.548C16.0405 10.3368 16.3015 10.2353 16.6124 10.2436C16.9233 10.252 17.1843 10.3618 17.3955 10.573C17.6068 10.7842 17.7124 11.0494 17.7124 11.3686C17.7124 11.6878 17.6068 11.9531 17.3955 12.1643L12.7955 16.7643C12.6836 16.8762 12.5603 16.957 12.4257 17.0067C12.2911 17.0563 12.1492 17.0811 11.9999 17.0811Z" fill="black"/>
              </g>
            </svg>
      	</label>
        
        <!-- Content to show/hide -->
        <ul class="mobile-wallet-adapter-embedded-modal-details-collapsible-content">
            <li>{{PERMISSION_INSTRUCTION_DETAIL}}</li>
            <li>Allow "Apps on Device"</li>
        </ul>
    </div>
</div>
<div>
    <button data-modal-action id="mobile-wallet-adapter-launch-action" class="mobile-wallet-adapter-embedded-modal-launch-action">
        Got it
    </button>
</div>
`;
  var css$3 = `
.mobile-wallet-adapter-embedded-modal-close {
    display: none;
}
.mobile-wallet-adapter-embedded-modal-content {
    text-align: center;
}
.mobile-wallet-adapter-embedded-modal-header {
    margin: 18px auto 30px auto;
    color: #7D9093;
    font-size: 1.0em;
    font-weight: 500;
}
.mobile-wallet-adapter-embedded-modal-title {
    margin: 18px 100px auto 100px;
    color: #000000;
    font-size: 2.75em;
    font-weight: 600;
}
.mobile-wallet-adapter-embedded-modal-subtitle {
    margin: 12px 60px 30px 60px;
    color: #7D9093;
    font-size: 1.25em;
    font-weight: 400;
}
.mobile-wallet-adapter-embedded-modal-details-collapsible-header {
    display: flex;
    flex-direction: row;
  	justify-content: space-between;
    margin: 10px auto 10px auto;
    color: #000000;
    font-size: 1.5em;
    font-weight: 600;
    cursor: pointer; /* Show pointer on hover */
    transition: background 0.2s ease; /* Smooth background change */
}
.mobile-wallet-adapter-embedded-modal-details-collapsible-header-icon {
  	transition: rotate 0.3s ease;
}
.mobile-wallet-adapter-embedded-modal-details-collapsible-input {
  	display: none; /* Hide the checkbox */
}
.mobile-wallet-adapter-embedded-modal-details-collapsible-content {
    margin: 0px auto 40px auto;
    max-height: 0px; /* Collapse content */
    overflow: hidden; /* Hide overflow when collapsed */
    transition: max-height 0.3s ease; /* Smooth transition */
}
.mobile-wallet-adapter-embedded-modal-details-collapsible-content li {
    margin: 20px auto;
    color: #000000;
    font-size: 1.25em;
    font-weight: 400;
    text-align: left;
}
/* When checkbox is checked, show content */
.mobile-wallet-adapter-embedded-modal-details-collapsible-header:has(> input:checked) ~ .mobile-wallet-adapter-embedded-modal-details-collapsible-content {
  	max-height: 300px;
}
.mobile-wallet-adapter-embedded-modal-details-collapsible-header:has(> input:checked) > .mobile-wallet-adapter-embedded-modal-details-collapsible-header-icon {
  	rotate: 180deg;
}
.mobile-wallet-adapter-embedded-modal-launch-action {
    display: block;
    width: 100%;
    height: 56px;
    /*margin-top: 40px;*/
    font-size: 1.25em;
    /*line-height: 24px;*/
    /*letter-spacing: -1%;*/
    background: #000000;
    color: #FFFFFF;
    border-radius: 18px;
}
/* Smaller screens */
@media all and (max-width: 600px) {
    .mobile-wallet-adapter-embedded-modal-title {
        font-size: 1.75em;
        margin-right: 12px;
        margin-left: 12px;
    }
    .mobile-wallet-adapter-embedded-modal-subtitle {
        margin-right: 12px;
        margin-left: 12px;
    }
}
`;
  var _LoopbackPermissionModal_instances, prepareLaunchAction_fn3, _a4;
  var LoopbackPermissionModal = (_a4 = class extends EmbeddedModal {
    constructor() {
      super(...arguments);
      __privateAdd(this, _LoopbackPermissionModal_instances);
      __publicField(this, "contentStyles", css$2);
      __publicField(this, "contentHtml", ErrorDialogHtml);
    }
    async init() {
      super.init();
      __privateMethod(this, _LoopbackPermissionModal_instances, prepareLaunchAction_fn3).call(this);
    }
  }, _LoopbackPermissionModal_instances = new WeakSet(), prepareLaunchAction_fn3 = function() {
    const launchButton = this.dom?.getElementById("mobile-wallet-adapter-launch-action");
    const listener = async () => {
      launchButton?.removeEventListener("click", listener);
      try {
        await fetch("http://localhost");
      } catch {
      }
      this.close();
    };
    launchButton?.addEventListener("click", listener);
  }, _a4);
  var ErrorDialogHtml = `
<div class="mobile-wallet-adapter-embedded-modal-title">Allow connections to your wallet</div>
<div id="mobile-wallet-adapter-local-launch-message" class="mobile-wallet-adapter-embedded-modal-subtitle">
    Tap "Allow" on the next screen
</div>
<svg class="mobile-wallet-adapter-embedded-modal-permission-prompt-mock" xmlns="http://www.w3.org/2000/svg" width="281" height="83" viewBox="0 0 281 83" fill="none">
    <rect width="281" height="83" rx="22" fill="#F0F3F5"/>
    <path d="M254.194 64L252.626 56.657H254.047L254.866 61.452L254.985 62.278H255.02L255.146 61.452L255.993 57.497H257.4L258.254 61.431L258.373 62.278H258.415L258.534 61.431L259.346 56.657H260.718L259.143 64H257.673L256.826 59.961L256.693 59.093H256.651L256.511 59.961L255.664 64H254.194Z" fill="black"/>
    <path d="M248.837 64.231C248.147 64.231 247.54 64.07 247.017 63.748C246.495 63.426 246.086 62.978 245.792 62.404C245.498 61.83 245.351 61.1673 245.351 60.416V60.241C245.351 59.4897 245.498 58.827 245.792 58.253C246.086 57.679 246.495 57.2333 247.017 56.916C247.54 56.594 248.147 56.433 248.837 56.433C249.528 56.433 250.135 56.594 250.657 56.916C251.18 57.2333 251.588 57.679 251.882 58.253C252.176 58.827 252.323 59.4897 252.323 60.241V60.416C252.323 61.1673 252.176 61.83 251.882 62.404C251.588 62.978 251.18 63.426 250.657 63.748C250.135 64.07 249.528 64.231 248.837 64.231ZM248.837 62.824C249.43 62.824 249.897 62.607 250.237 62.173C250.583 61.7343 250.755 61.1417 250.755 60.395V60.262C250.755 59.5107 250.583 58.918 250.237 58.484C249.897 58.05 249.43 57.833 248.837 57.833C248.249 57.833 247.783 58.05 247.437 58.484C247.092 58.918 246.919 59.5107 246.919 60.262V60.395C246.919 61.1417 247.092 61.7343 247.437 62.173C247.783 62.607 248.249 62.824 248.837 62.824Z" fill="black"/>
    <path d="M242.298 64.231C241.467 64.231 240.814 63.993 240.338 63.517C239.866 63.0364 239.631 62.3737 239.631 61.529V53.78H241.178V61.389C241.178 62.3317 241.591 62.803 242.417 62.803C242.65 62.803 242.865 62.7587 243.061 62.67C243.257 62.5814 243.464 62.4367 243.684 62.236L244.538 63.377C244.225 63.6664 243.884 63.881 243.516 64.021C243.152 64.161 242.746 64.231 242.298 64.231ZM237.51 55.061V53.78H240.611V55.061H237.51Z" fill="black"/>
    <path d="M234.463 64.231C233.633 64.231 232.979 63.993 232.503 63.517C232.032 63.0364 231.796 62.3737 231.796 61.529V53.78H233.343V61.389C233.343 62.3317 233.756 62.803 234.582 62.803C234.816 62.803 235.03 62.7587 235.226 62.67C235.422 62.5814 235.63 62.4367 235.849 62.236L236.703 63.377C236.391 63.6664 236.05 63.881 235.681 64.021C235.317 64.161 234.911 64.231 234.463 64.231ZM229.675 55.061V53.78H232.776V55.061H229.675Z" fill="black"/>
    <path d="M221.442 64L224.557 53.976H226.132L229.233 64H227.581L225.642 56.972L225.341 55.761H225.299L225.005 56.972L223.073 64H221.442ZM222.835 61.634L223.255 60.29H227.371L227.805 61.634H222.835Z" fill="black"/>
    <path d="M178.261 64L175.034 60.066V60.024L178.121 56.657H180.011L176.504 60.423V59.632L180.165 64H178.261ZM173.543 64V53.78H175.097V64H173.543Z" fill="#7D9093" fill-opacity="0.5"/>
    <path d="M169.306 64.224C168.588 64.224 167.958 64.0653 167.416 63.748C166.88 63.426 166.462 62.9803 166.163 62.411C165.865 61.837 165.715 61.1673 165.715 60.402V60.248C165.715 59.4873 165.862 58.8223 166.156 58.253C166.45 57.679 166.863 57.2333 167.395 56.916C167.927 56.594 168.546 56.433 169.25 56.433C169.978 56.433 170.59 56.6056 171.084 56.951C171.579 57.2917 171.955 57.777 172.211 58.407L170.874 58.995C170.72 58.6123 170.508 58.323 170.237 58.127C169.967 57.9263 169.633 57.826 169.236 57.826C168.63 57.826 168.149 58.0383 167.794 58.463C167.444 58.883 167.269 59.4616 167.269 60.199V60.465C167.269 61.1837 167.454 61.7577 167.822 62.187C168.196 62.6163 168.69 62.831 169.306 62.831C169.712 62.831 170.06 62.733 170.349 62.537C170.639 62.341 170.877 62.0423 171.063 61.641L172.379 62.285C172.188 62.6957 171.941 63.0457 171.637 63.335C171.334 63.6243 170.986 63.846 170.594 64C170.202 64.1493 169.773 64.224 169.306 64.224Z" fill="#7D9093" fill-opacity="0.5"/>
    <path d="M161.003 64.231C160.312 64.231 159.706 64.07 159.183 63.748C158.66 63.426 158.252 62.978 157.958 62.404C157.664 61.83 157.517 61.1673 157.517 60.416V60.241C157.517 59.4897 157.664 58.827 157.958 58.253C158.252 57.679 158.66 57.2333 159.183 56.916C159.706 56.594 160.312 56.433 161.003 56.433C161.694 56.433 162.3 56.594 162.823 56.916C163.346 57.2333 163.754 57.679 164.048 58.253C164.342 58.827 164.489 59.4897 164.489 60.241V60.416C164.489 61.1673 164.342 61.83 164.048 62.404C163.754 62.978 163.346 63.426 162.823 63.748C162.3 64.07 161.694 64.231 161.003 64.231ZM161.003 62.824C161.596 62.824 162.062 62.607 162.403 62.173C162.748 61.7343 162.921 61.1417 162.921 60.395V60.262C162.921 59.5107 162.748 58.918 162.403 58.484C162.062 58.05 161.596 57.833 161.003 57.833C160.415 57.833 159.948 58.05 159.603 58.484C159.258 58.918 159.085 59.5107 159.085 60.262V60.395C159.085 61.1417 159.258 61.7343 159.603 62.173C159.948 62.607 160.415 62.824 161.003 62.824Z" fill="#7D9093" fill-opacity="0.5"/>
    <path d="M154.463 64.231C153.633 64.231 152.979 63.993 152.503 63.517C152.032 63.0364 151.796 62.3737 151.796 61.529V53.78H153.343V61.389C153.343 62.3317 153.756 62.803 154.582 62.803C154.816 62.803 155.03 62.7587 155.226 62.67C155.422 62.5814 155.63 62.4367 155.849 62.236L156.703 63.377C156.391 63.6664 156.05 63.881 155.681 64.021C155.317 64.161 154.911 64.231 154.463 64.231ZM149.675 55.061V53.78H152.776V55.061H149.675Z" fill="#7D9093" fill-opacity="0.5"/>
    <path d="M142.24 64V53.976H145.544C146.421 53.976 147.112 54.1953 147.616 54.634C148.12 55.0726 148.372 55.6583 148.372 56.391V56.566C148.372 57.0886 148.246 57.5366 147.994 57.91C147.742 58.2833 147.38 58.5586 146.909 58.736V58.792C147.492 58.9226 147.947 59.2003 148.274 59.625C148.605 60.045 148.771 60.5606 148.771 61.172V61.361C148.771 61.893 148.645 62.3573 148.393 62.754C148.145 63.1506 147.795 63.4586 147.343 63.678C146.895 63.8926 146.365 64 145.754 64H142.24ZM143.794 62.656H145.572C146.085 62.656 146.482 62.5253 146.762 62.264C147.042 62.0026 147.182 61.6293 147.182 61.144V60.99C147.182 60.5046 147.037 60.1313 146.748 59.87C146.463 59.604 146.05 59.471 145.509 59.471H143.36V58.183H145.32C145.791 58.183 146.153 58.064 146.405 57.826C146.657 57.588 146.783 57.2496 146.783 56.811V56.685C146.783 56.2416 146.657 55.9033 146.405 55.67C146.157 55.4366 145.796 55.32 145.32 55.32H143.794V62.656Z" fill="#7D9093" fill-opacity="0.5"/>
    <rect x="18" y="17" width="246" height="7" rx="3.5" fill="#7D9093" fill-opacity="0.26"/>
    <rect x="18" y="33" width="82" height="7" rx="3.5" fill="#7D9093" fill-opacity="0.26"/>
</svg>
<div>
    <button data-modal-action id="mobile-wallet-adapter-launch-action" class="mobile-wallet-adapter-embedded-modal-launch-action">
        Continue to Allow
    </button>
</div>
`;
  var css$2 = `
.mobile-wallet-adapter-embedded-modal-close {
    display: none;
}
.mobile-wallet-adapter-embedded-modal-content {
    text-align: center;
}
.mobile-wallet-adapter-embedded-modal-title {
    margin: 18px 100px auto 100px;
    color: #000000;
    font-size: 2.75em;
    font-weight: 600;
}
.mobile-wallet-adapter-embedded-modal-subtitle {
    margin: 20px 60px 40px 60px;
    color: #7D9093;
    font-size: 1.25em;
    font-weight: 400;
}
.mobile-wallet-adapter-embedded-modal-permission-prompt-mock {
    width: 90%;
    height: auto;
    margin: 0 auto 30px auto;
    display: block;
}
.mobile-wallet-adapter-embedded-modal-launch-action {
    display: block;
    width: 100%;
    height: 56px;
    font-size: 1.25em;
    background: #000000;
    color: #FFFFFF;
    border-radius: 18px;
}
/* Smaller screens */
@media all and (max-width: 600px) {
    .mobile-wallet-adapter-embedded-modal-title {
        font-size: 1.5em;
        margin-right: 12px;
        margin-left: 12px;
    }
    .mobile-wallet-adapter-embedded-modal-subtitle {
        margin-right: 12px;
        margin-left: 12px;
    }
}
`;
  function getIsLocalAssociationSupported() {
    return typeof window !== "undefined" && window.isSecureContext && typeof document !== "undefined" && /android/i.test(navigator.userAgent);
  }
  function getIsRemoteAssociationSupported() {
    return typeof window !== "undefined" && window.isSecureContext && typeof document !== "undefined" && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  function isWebView(userAgentString) {
    return /(WebView|Version\/.+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+)|; wv\).+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+))/i.test(userAgentString);
  }
  function isSolanaMobileWebShell(userAgentString) {
    return userAgentString.includes("Solana Mobile Web Shell");
  }
  function getIsPwaLaunchedAsApp() {
    const isAndroidTwa = typeof document !== "undefined" && document.referrer.startsWith("android-app://");
    if (typeof window == "undefined") return isAndroidTwa;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
    const isMinimalUI = window.matchMedia("(display-mode: minimal-ui)").matches;
    return isAndroidTwa || isStandalone || isFullscreen || isMinimalUI;
  }
  async function isLocalWebSocketAvailable() {
    if (typeof navigator !== "undefined" && isSolanaMobileWebShell(navigator.userAgent)) return true;
    try {
      return (await navigator.permissions.query({ name: "loopback-network" })).state === "granted";
    } catch (e2) {
      if (e2 instanceof TypeError && (e2.message.includes("loopback-network") || e2.message.includes("local-network-access"))) return true;
      return false;
    }
  }
  async function checkLocalNetworkAccessPermission() {
    if (typeof navigator !== "undefined" && isSolanaMobileWebShell(navigator.userAgent)) return;
    try {
      const lnaPermission = await navigator.permissions.query({ name: "loopback-network" });
      if (lnaPermission.state === "granted") return;
      else if (lnaPermission.state === "denied") {
        const modal = new LoopbackPermissionBlockedModal();
        modal.init();
        modal.open();
        throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_LOOPBACK_ACCESS_BLOCKED, "Local Network Access permission denied");
      } else if (lnaPermission.state === "prompt") {
        const modal = new LoopbackPermissionModal();
        if (await new Promise((resolve, reject) => {
          modal.addEventListener("close", (event) => {
            if (event) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_CANCELLED, "Wallet connection cancelled by user", { event }));
          });
          lnaPermission.onchange = () => {
            lnaPermission.onchange = null;
            resolve(lnaPermission.state);
          };
          modal.init();
          modal.open();
        }) === "granted") {
          const modal2 = new LocalConnectionModal();
          await new Promise((resolve, reject) => {
            modal2.addEventListener("close", (event) => {
              if (event) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_CANCELLED, "Wallet connection cancelled by user", { event }));
            });
            modal2.initWithCallback(async () => {
              resolve(true);
            });
            modal2.open();
          });
          return;
        } else return await checkLocalNetworkAccessPermission();
      }
      throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_LOOPBACK_ACCESS_BLOCKED, "Local Network Access permission unknown");
    } catch (e2) {
      if (e2 instanceof TypeError && (e2.message.includes("loopback-network") || e2.message.includes("local-network-access"))) return;
      if (e2 instanceof SolanaMobileWalletAdapterError) throw e2;
      throw new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_LOOPBACK_ACCESS_BLOCKED, e2 instanceof Error ? e2.message : "Local Network Access permission unknown");
    }
  }
  var modalHtml = `
<div class="mobile-wallet-adapter-embedded-loading-indicator" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div data-modal-close style="position: absolute; width: 100%; height: 100%;"></div>
    <div class="mobile-wallet-adapter-embedded-loading-container">
        <div class="mobile-wallet-adapter-embedded-loading-animation"></div>
    </div>
</div>
`;
  var css$1 = `
.mobile-wallet-adapter-embedded-loading-indicator {
    display: flex; /* Use flexbox to center content */
    justify-content: center; /* Center horizontally */
    align-items: start; /* Center vertically */
    position: fixed; /* Stay in place */
    z-index: 1; /* Sit on top */
    left: 0;
    top: 0;
    width: 100%; /* Full width */
    height: 100%; /* Full height */
    background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
    overflow-y: auto; /* enable scrolling */
}

.mobile-wallet-adapter-embedded-loading-container {
    display: flex;
    margin: auto;
}

.mobile-wallet-adapter-embedded-loading-animation {
    position: relative;
    left: -9999px;
    width: 10px;
    height: 10px;
    border-radius: 5px;
    background-color: var(--spinner-color);
    color: var(--spinner-color);
    box-shadow: 9984px 0 0 0 var(--spinner-color), 
                9999px 0 0 0 var(--spinner-color), 
                10014px 0 0 0 var(--spinner-color);
    animation: dot-typing 1.5s infinite linear;
}

@keyframes dot-typing {
    0% {
        box-shadow: 9984px 0 0 0 var(--spinner-color), 
                    9999px 0 0 0 var(--spinner-color), 
                    10014px 0 0 0 var(--spinner-color);
    }
    16.667% {
        box-shadow: 9984px -10px 0 0 var(--spinner-color), 
                    9999px 0 0 0 var(--spinner-color), 
                    10014px 0 0 0 var(--spinner-color);
    }
    33.333% {
        box-shadow: 9984px 0 0 0 var(--spinner-color), 
                    9999px 0 0 0 var(--spinner-color), 
                    10014px 0 0 0 var(--spinner-color);
    }
    50% {
        box-shadow: 9984px 0 0 0 var(--spinner-color), 
                    9999px -10px 0 0 var(--spinner-color), 
                    10014px 0 0 0 var(--spinner-color);
    }
    66.667% {
        box-shadow: 9984px 0 0 0 var(--spinner-color), 
                    9999px 0 0 0 var(--spinner-color), 
                    10014px 0 0 0 var(--spinner-color);
    }
    83.333% {
        box-shadow: 9984px 0 0 0 var(--spinner-color), 
                    9999px 0 0 0 var(--spinner-color), 
                    10014px -10px 0 0 var(--spinner-color);
    }
    100% {
        box-shadow: 9984px 0 0 0 var(--spinner-color), 
                    9999px 0 0 0 var(--spinner-color), 
                    10014px 0 0 0 var(--spinner-color);
    }
}
`;
  var _root2, _eventListeners2, _listenersAttached2, _EmbeddedLoadingSpinner_instances, injectHTML_fn2, attachEventListeners_fn2, removeEventListeners_fn2, _handleKeyDown2, _a5;
  var EmbeddedLoadingSpinner = (_a5 = class {
    constructor() {
      __privateAdd(this, _EmbeddedLoadingSpinner_instances);
      __privateAdd(this, _root2, null);
      __privateAdd(this, _eventListeners2, {});
      __privateAdd(this, _listenersAttached2, false);
      __publicField(this, "dom", null);
      __publicField(this, "open", () => {
        console.debug("Modal open");
        __privateMethod(this, _EmbeddedLoadingSpinner_instances, attachEventListeners_fn2).call(this);
        if (__privateGet(this, _root2)) __privateGet(this, _root2).style.display = "flex";
      });
      __publicField(this, "close", (event = void 0) => {
        console.debug("Modal close");
        __privateMethod(this, _EmbeddedLoadingSpinner_instances, removeEventListeners_fn2).call(this);
        if (__privateGet(this, _root2)) __privateGet(this, _root2).style.display = "none";
        __privateGet(this, _eventListeners2)["close"]?.forEach((listener) => listener(event));
      });
      __privateAdd(this, _handleKeyDown2, (event) => {
        if (event.key === "Escape") this.close(event);
      });
      this.init = this.init.bind(this);
      __privateSet(this, _root2, document.getElementById("mobile-wallet-adapter-embedded-root-ui"));
    }
    async init() {
      console.log("Injecting modal");
      __privateMethod(this, _EmbeddedLoadingSpinner_instances, injectHTML_fn2).call(this);
    }
    addEventListener(event, listener) {
      __privateGet(this, _eventListeners2)[event]?.push(listener) || (__privateGet(this, _eventListeners2)[event] = [listener]);
      return () => this.removeEventListener(event, listener);
    }
    removeEventListener(event, listener) {
      __privateGet(this, _eventListeners2)[event] = __privateGet(this, _eventListeners2)[event]?.filter((existingListener) => listener !== existingListener);
    }
  }, _root2 = new WeakMap(), _eventListeners2 = new WeakMap(), _listenersAttached2 = new WeakMap(), _EmbeddedLoadingSpinner_instances = new WeakSet(), injectHTML_fn2 = function() {
    if (this.dom) return;
    __privateSet(this, _root2, document.createElement("div"));
    __privateGet(this, _root2).id = "mobile-wallet-adapter-embedded-root-ui";
    __privateGet(this, _root2).innerHTML = modalHtml;
    __privateGet(this, _root2).style.display = "none";
    const styles = document.createElement("style");
    styles.id = "mobile-wallet-adapter-embedded-modal-styles";
    styles.textContent = css$1;
    const host = document.createElement("div");
    this.dom = host.attachShadow({ mode: "closed" });
    host.style.setProperty("--spinner-color", "#FFFFFF");
    this.dom.appendChild(styles);
    this.dom.appendChild(__privateGet(this, _root2));
    document.body.appendChild(host);
  }, attachEventListeners_fn2 = function() {
    if (!__privateGet(this, _root2) || __privateGet(this, _listenersAttached2)) return;
    [...__privateGet(this, _root2).querySelectorAll("[data-modal-close]")].forEach((closer) => closer?.addEventListener("click", (event) => {
      this.close(event);
    }));
    window.addEventListener("load", this.close);
    document.addEventListener("keydown", __privateGet(this, _handleKeyDown2));
    __privateSet(this, _listenersAttached2, true);
  }, removeEventListeners_fn2 = function() {
    if (!__privateGet(this, _listenersAttached2)) return;
    window.removeEventListener("load", this.close);
    document.removeEventListener("keydown", __privateGet(this, _handleKeyDown2));
    if (!__privateGet(this, _root2)) return;
    [...__privateGet(this, _root2).querySelectorAll("[data-modal-close]")].forEach((closer) => closer?.removeEventListener("click", this.close));
    __privateSet(this, _listenersAttached2, false);
  }, _handleKeyDown2 = new WeakMap(), _a5);
  var RemoteConnectionModal = class extends EmbeddedModal {
    constructor() {
      super(...arguments);
      __publicField(this, "contentStyles", css);
      __publicField(this, "contentHtml", QRCodeHtml);
    }
    async initWithQR(qrCode) {
      super.init();
      this.populateQRCode(qrCode);
    }
    async populateQRCode(qrUrl) {
      const qrcodeContainer = this.dom?.getElementById("mobile-wallet-adapter-embedded-modal-qr-code-container");
      if (qrcodeContainer) {
        const qrCodeElement = await import_qrcode.default.toCanvas(qrUrl, {
          width: 200,
          margin: 0
        });
        if (qrcodeContainer.firstElementChild !== null) qrcodeContainer.replaceChild(qrCodeElement, qrcodeContainer.firstElementChild);
        else qrcodeContainer.appendChild(qrCodeElement);
        const qrPlaceholder = this.dom?.getElementById("mobile-wallet-adapter-embedded-modal-qr-placeholder");
        if (qrPlaceholder) qrPlaceholder.style.display = "none";
      } else console.error("QRCode Container not found");
    }
  };
  var QRCodeHtml = `
<div class="mobile-wallet-adapter-embedded-modal-qr-content">
    <div>
        <svg class="mobile-wallet-adapter-embedded-modal-icon" width="100%" height="100%">
            <circle r="52" cx="53" cy="53" fill="#99b3be" stroke="#000000" stroke-width="2"/>
            <path d="m 53,82.7305 c -3.3116,0 -6.1361,-1.169 -8.4735,-3.507 -2.338,-2.338 -3.507,-5.1625 -3.507,-8.4735 0,-3.3116 1.169,-6.1364 3.507,-8.4744 2.3374,-2.338 5.1619,-3.507 8.4735,-3.507 3.3116,0 6.1361,1.169 8.4735,3.507 2.338,2.338 3.507,5.1628 3.507,8.4744 0,3.311 -1.169,6.1355 -3.507,8.4735 -2.3374,2.338 -5.1619,3.507 -8.4735,3.507 z m 0.007,-5.25 c 1.8532,0 3.437,-0.6598 4.7512,-1.9793 1.3149,-1.3195 1.9723,-2.9058 1.9723,-4.7591 0,-1.8526 -0.6598,-3.4364 -1.9793,-4.7512 -1.3195,-1.3149 -2.9055,-1.9723 -4.7582,-1.9723 -1.8533,0 -3.437,0.6598 -4.7513,1.9793 -1.3148,1.3195 -1.9722,2.9058 -1.9722,4.7591 0,1.8527 0.6597,3.4364 1.9792,4.7512 1.3195,1.3149 2.9056,1.9723 4.7583,1.9723 z m -28,-33.5729 -3.85,-3.6347 c 4.1195,-4.025 8.8792,-7.1984 14.2791,-9.52 5.4005,-2.3223 11.2551,-3.4834 17.5639,-3.4834 6.3087,0 12.1634,1.1611 17.5639,3.4834 5.3999,2.3216 10.1596,5.495 14.2791,9.52 l -3.85,3.6347 C 77.2999,40.358 73.0684,37.5726 68.2985,35.5514 63.5292,33.5301 58.4296,32.5195 53,32.5195 c -5.4297,0 -10.5292,1.0106 -15.2985,3.0319 -4.7699,2.0212 -9.0014,4.8066 -12.6945,8.3562 z m 44.625,10.8771 c -2.2709,-2.1046 -4.7962,-3.7167 -7.5758,-4.8361 -2.7795,-1.12 -5.7983,-1.68 -9.0562,-1.68 -3.2579,0 -6.2621,0.56 -9.0125,1.68 -2.7504,1.1194 -5.2903,2.7315 -7.6195,4.8361 L 32.5189,51.15 c 2.8355,-2.6028 5.9777,-4.6086 9.4263,-6.0174 3.4481,-1.4087 7.133,-2.1131 11.0548,-2.1131 3.9217,0 7.5979,0.7044 11.0285,2.1131 3.43,1.4088 6.5631,3.4146 9.3992,6.0174 z"/>
        </svg>
        <div class="mobile-wallet-adapter-embedded-modal-title">Remote Mobile Wallet Adapter</div>
    </div>
    <div>
        <div>
            <h4 class="mobile-wallet-adapter-embedded-modal-qr-label">
                Open your wallet and scan this code
            </h4>
        </div>
        <div id="mobile-wallet-adapter-embedded-modal-qr-code-container" class="mobile-wallet-adapter-embedded-modal-qr-code-container">
            <div id="mobile-wallet-adapter-embedded-modal-qr-placeholder" class="mobile-wallet-adapter-embedded-modal-qr-placeholder"></div>
        </div>
    </div>
</div>
<div class="mobile-wallet-adapter-embedded-modal-divider"><hr></div>
<div class="mobile-wallet-adapter-embedded-modal-footer">
    <div class="mobile-wallet-adapter-embedded-modal-subtitle">
        Follow the instructions on your device. When you're finished, this screen will update.
    </div>
    <div class="mobile-wallet-adapter-embedded-modal-progress-badge">
        <div>
            <div class="spinner">
                <div class="leftWrapper">
                    <div class="left">
                        <div class="circle"></div>
                    </div>
                </div>
                <div class="rightWrapper">
                    <div class="right">
                        <div class="circle"></div>
                    </div>
                </div>
            </div>
        </div>
        <div>Waiting for scan</div>
    </div>
</div>
`;
  var css = `
.mobile-wallet-adapter-embedded-modal-qr-content {
    display: flex; 
    margin-top: 10px;
    padding: 10px;
}

.mobile-wallet-adapter-embedded-modal-qr-content > div:first-child {
    display: flex;
    flex-direction: column;
    flex: 2;
    margin-top: auto;
    margin-right: 30px;
}

.mobile-wallet-adapter-embedded-modal-qr-content > div:nth-child(2) {
    display: flex;
    flex-direction: column;
    flex: 1;
    margin-left: auto;
}

.mobile-wallet-adapter-embedded-modal-footer {
    display: flex;
    padding: 10px;
}

.mobile-wallet-adapter-embedded-modal-icon {}

.mobile-wallet-adapter-embedded-modal-title {
    color: #000000;
    font-size: 2.5em;
    font-weight: 600;
}

.mobile-wallet-adapter-embedded-modal-qr-label {
    text-align: right;
    color: #000000;
}

.mobile-wallet-adapter-embedded-modal-qr-code-container {
    margin-left: auto;
}

.mobile-wallet-adapter-embedded-modal-qr-placeholder {
    margin-left: auto;
    min-width: 200px;
    min-height: 200px;
    background: linear-gradient(-60deg, #F7F8F8 30%, #ECEEEE 50%, #F7F8F8 70%);
    background-size: 200%;
    animation: placeholderAnimate 2.7s linear infinite;
    border-radius: 12px;
}

.mobile-wallet-adapter-embedded-modal-divider {
    margin-top: 20px;
    padding-left: 10px;
    padding-right: 10px;
}

.mobile-wallet-adapter-embedded-modal-divider hr {
    border-top: 1px solid #D9DEDE;
}

.mobile-wallet-adapter-embedded-modal-subtitle {
    margin: auto;
    margin-right: 60px;
    padding: 20px;
    color: #6E8286;
}

.mobile-wallet-adapter-embedded-modal-progress-badge {
    display: flex;
    background: #F7F8F8;
    height: 56px;
    min-width: 200px;
    margin: auto;
    padding-left: 20px;
    padding-right: 20px;
    border-radius: 18px;
    color: #A8B6B8;
    align-items: center;
}

.mobile-wallet-adapter-embedded-modal-progress-badge > div:first-child {
    margin-left: auto;
    margin-right: 20px;
}

.mobile-wallet-adapter-embedded-modal-progress-badge > div:nth-child(2) {
    margin-right: auto;
}

/* Smaller screens */
@media all and (max-width: 600px) {
    .mobile-wallet-adapter-embedded-modal-card {
        text-align: center;
    }
    .mobile-wallet-adapter-embedded-modal-qr-content {
        flex-direction: column;
    }
    .mobile-wallet-adapter-embedded-modal-qr-content > div:first-child {
        margin: auto;
    }
    .mobile-wallet-adapter-embedded-modal-qr-content > div:nth-child(2) {
        margin: auto;
        flex: 2 auto;
    }
    .mobile-wallet-adapter-embedded-modal-footer {
        flex-direction: column;
    }
    .mobile-wallet-adapter-embedded-modal-icon {
        display: none;
    }
    .mobile-wallet-adapter-embedded-modal-title {
        font-size: 1.5em;
    }
    .mobile-wallet-adapter-embedded-modal-subtitle {
        margin-right: unset;
    }
    .mobile-wallet-adapter-embedded-modal-qr-label {
        text-align: center;
    }
    .mobile-wallet-adapter-embedded-modal-qr-code-container {
        margin: auto;
    }
    .mobile-wallet-adapter-embedded-modal-qr-placeholder {
        margin: auto;
    }
}

/* QR Placeholder */
@keyframes placeholderAnimate {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Spinner */
@keyframes spinLeft {
    0% {
        transform: rotate(20deg);
    }
    50% {
        transform: rotate(160deg);
    }
    100% {
        transform: rotate(20deg);
    }
}
@keyframes spinRight {
    0% {
        transform: rotate(160deg);
    }
    50% {
        transform: rotate(20deg);
    }
    100% {
        transform: rotate(160deg);
    }
}
@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(2520deg);
    }
}

.spinner {
    position: relative;
    width: 1.5em;
    height: 1.5em;
    margin: auto;
    animation: spin 10s linear infinite;
}
.spinner::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
}
.right, .rightWrapper, .left, .leftWrapper {
    position: absolute;
    top: 0;
    overflow: hidden;
    width: .75em;
    height: 1.5em;
}
.left, .leftWrapper {
    left: 0;
}
.right {
    left: -12px;
}
.rightWrapper {
    right: 0;
}
.circle {
    border: .125em solid #A8B6B8;
    width: 1.25em; /* 1.5em - 2*0.125em border */
    height: 1.25em; /* 1.5em - 2*0.125em border */
    border-radius: 0.75em; /* 0.5*1.5em spinner size 8 */
}
.left {
    transform-origin: 100% 50%;
    animation: spinLeft 2.5s cubic-bezier(.2,0,.8,1) infinite;
}
.right {
    transform-origin: 100% 50%;
    animation: spinRight 2.5s cubic-bezier(.2,0,.8,1) infinite;
}
`;
  var icon = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03IDIuNUgxN0MxNy44Mjg0IDIuNSAxOC41IDMuMTcxNTcgMTguNSA0VjIwQzE4LjUgMjAuODI4NCAxNy44Mjg0IDIxLjUgMTcgMjEuNUg3QzYuMTcxNTcgMjEuNSA1LjUgMjAuODI4NCA1LjUgMjBWNEM1LjUgMy4xNzE1NyA2LjE3MTU3IDIuNSA3IDIuNVpNMyA0QzMgMS43OTA4NiA0Ljc5MDg2IDAgNyAwSDE3QzE5LjIwOTEgMCAyMSAxLjc5MDg2IDIxIDRWMjBDMjEgMjIuMjA5MSAxOS4yMDkxIDI0IDE3IDI0SDdDNC43OTA4NiAyNCAzIDIyLjIwOTEgMyAyMFY0Wk0xMSA0LjYxNTM4QzEwLjQ0NzcgNC42MTUzOCAxMCA1LjA2MzEgMTAgNS42MTUzOFY2LjM4NDYyQzEwIDYuOTM2OSAxMC40NDc3IDcuMzg0NjIgMTEgNy4zODQ2MkgxM0MxMy41NTIzIDcuMzg0NjIgMTQgNi45MzY5IDE0IDYuMzg0NjJWNS42MTUzOEMxNCA1LjA2MzEgMTMuNTUyMyA0LjYxNTM4IDEzIDQuNjE1MzhIMTFaIiBmaWxsPSIjRENCOEZGIi8+Cjwvc3ZnPgo=";
  var SolanaMobileWalletAdapterWalletName = "Mobile Wallet Adapter";
  var SolanaMobileWalletAdapterRemoteWalletName = "Remote Mobile Wallet Adapter";
  var DEFAULT_FEATURES = [
    SolanaSignAndSendTransaction,
    SolanaSignTransaction,
    SolanaSignMessage,
    SolanaSignIn
  ];
  var WALLET_ASSOCIATION_TIMEOUT = 3e4;
  function getErrorMessage2(error) {
    return error instanceof Error ? error.message : "Unknown error";
  }
  var _listeners, _version, _name, _url, _icon, _appIdentity, _authorization, _authorizationCache, _connecting, _connectionGeneration, _chains, _chainSelector, _optionalFeatures, _onWalletNotFound, _nostrRelay, _on, _LocalSolanaMobileWalletAdapterWallet_instances, emit_fn, off_fn, _connect, _performAuthorization, _handleAuthorizationResult, _handleWalletCapabilitiesResult, _performReauthorization, _disconnect, _transact, _assertIsAuthorized, _accountsToWalletStandardAccounts, _performSignTransactions, _performSignAndSendTransaction, _signAndSendTransaction, _signTransaction, _signMessage, _signIn, _performSignIn, _a6;
  var LocalSolanaMobileWalletAdapterWallet = (_a6 = class {
    constructor(config) {
      __privateAdd(this, _LocalSolanaMobileWalletAdapterWallet_instances);
      __privateAdd(this, _listeners, {});
      __privateAdd(this, _version, "1.0.0");
      __privateAdd(this, _name, SolanaMobileWalletAdapterWalletName);
      __privateAdd(this, _url, "https://solanamobile.com/wallets");
      __privateAdd(this, _icon, icon);
      __privateAdd(this, _appIdentity);
      __privateAdd(this, _authorization);
      __privateAdd(this, _authorizationCache);
      __privateAdd(this, _connecting, false);
      /**
      * Every time the connection is recycled in some way (eg. `disconnect()` is called)
      * increment this and use it to make sure that `transact` calls from the previous
      * 'generation' don't continue to do work and throw exceptions.
      */
      __privateAdd(this, _connectionGeneration, 0);
      __privateAdd(this, _chains, []);
      __privateAdd(this, _chainSelector);
      __privateAdd(this, _optionalFeatures);
      __privateAdd(this, _onWalletNotFound);
      __privateAdd(this, _nostrRelay);
      __privateAdd(this, _on, (event, listener) => {
        __privateGet(this, _listeners)[event]?.push(listener) || (__privateGet(this, _listeners)[event] = [listener]);
        return () => __privateMethod(this, _LocalSolanaMobileWalletAdapterWallet_instances, off_fn).call(this, event, listener);
      });
      __privateAdd(this, _connect, async ({ silent } = {}) => {
        if (__privateGet(this, _connecting) || this.connected) return { accounts: this.accounts };
        __privateSet(this, _connecting, true);
        try {
          if (silent) {
            const cachedAuthorization = await __privateGet(this, _authorizationCache).get();
            if (cachedAuthorization) {
              await __privateGet(this, _handleWalletCapabilitiesResult).call(this, cachedAuthorization.capabilities);
              await __privateGet(this, _handleAuthorizationResult).call(this, cachedAuthorization);
            } else return { accounts: this.accounts };
          } else await __privateGet(this, _performAuthorization).call(this);
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        } finally {
          __privateSet(this, _connecting, false);
        }
        return { accounts: this.accounts };
      });
      __privateAdd(this, _performAuthorization, async (signInPayload) => {
        try {
          const cachedAuthorizationResult = await __privateGet(this, _authorizationCache).get();
          if (cachedAuthorizationResult) {
            __privateGet(this, _handleAuthorizationResult).call(this, cachedAuthorizationResult);
            return cachedAuthorizationResult;
          }
          const selectedChain = await __privateGet(this, _chainSelector).select(__privateGet(this, _chains));
          return await __privateGet(this, _transact).call(this, async (wallet) => {
            const [capabilities, mwaAuthorizationResult] = await Promise.all([wallet.getCapabilities(), wallet.authorize({
              chain: selectedChain,
              identity: __privateGet(this, _appIdentity),
              sign_in_payload: signInPayload
            })]);
            const accounts = __privateGet(this, _accountsToWalletStandardAccounts).call(this, mwaAuthorizationResult.accounts);
            const authorization = {
              ...mwaAuthorizationResult,
              accounts,
              chain: selectedChain,
              capabilities
            };
            Promise.all([
              __privateGet(this, _handleWalletCapabilitiesResult).call(this, capabilities),
              __privateGet(this, _authorizationCache).set(authorization),
              __privateGet(this, _handleAuthorizationResult).call(this, authorization)
            ]);
            return authorization;
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _handleAuthorizationResult, async (authorization) => {
        const didPublicKeysChange = __privateGet(this, _authorization) == null || __privateGet(this, _authorization)?.accounts.length !== authorization.accounts.length || __privateGet(this, _authorization).accounts.some((account, ii) => account.address !== authorization.accounts[ii].address);
        __privateSet(this, _authorization, authorization);
        if (didPublicKeysChange) __privateMethod(this, _LocalSolanaMobileWalletAdapterWallet_instances, emit_fn).call(this, "change", { accounts: this.accounts });
      });
      __privateAdd(this, _handleWalletCapabilitiesResult, async (capabilities) => {
        const supportsSignTransaction = capabilities.features.includes("solana:signTransactions");
        const supportsSignAndSendTransaction = capabilities.supports_sign_and_send_transactions;
        const didCapabilitiesChange = SolanaSignAndSendTransaction in this.features !== supportsSignAndSendTransaction || SolanaSignTransaction in this.features !== supportsSignTransaction;
        __privateSet(this, _optionalFeatures, {
          ...(supportsSignAndSendTransaction || !supportsSignAndSendTransaction && !supportsSignTransaction) && { [SolanaSignAndSendTransaction]: {
            version: "1.0.0",
            supportedTransactionVersions: ["legacy", 0],
            signAndSendTransaction: __privateGet(this, _signAndSendTransaction)
          } },
          ...supportsSignTransaction && { [SolanaSignTransaction]: {
            version: "1.0.0",
            supportedTransactionVersions: ["legacy", 0],
            signTransaction: __privateGet(this, _signTransaction)
          } }
        });
        if (didCapabilitiesChange) __privateMethod(this, _LocalSolanaMobileWalletAdapterWallet_instances, emit_fn).call(this, "change", { features: this.features });
      });
      __privateAdd(this, _performReauthorization, async (wallet, authToken, chain) => {
        try {
          const [capabilities, mwaAuthorizationResult] = await Promise.all([__privateGet(this, _authorization)?.capabilities ?? await wallet.getCapabilities(), wallet.authorize({
            auth_token: authToken,
            identity: __privateGet(this, _appIdentity),
            chain
          })]);
          const accounts = __privateGet(this, _accountsToWalletStandardAccounts).call(this, mwaAuthorizationResult.accounts);
          const authorization = {
            ...mwaAuthorizationResult,
            accounts,
            chain,
            capabilities
          };
          Promise.all([__privateGet(this, _authorizationCache).set(authorization), __privateGet(this, _handleAuthorizationResult).call(this, authorization)]);
        } catch (e2) {
          __privateGet(this, _disconnect).call(this);
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _disconnect, async () => {
        __privateGet(this, _authorizationCache).clear();
        __privateSet(this, _connecting, false);
        __privateWrapper(this, _connectionGeneration)._++;
        __privateSet(this, _authorization, void 0);
        __privateMethod(this, _LocalSolanaMobileWalletAdapterWallet_instances, emit_fn).call(this, "change", { accounts: this.accounts });
      });
      __privateAdd(this, _transact, async (callback) => {
        const walletUriBase = __privateGet(this, _authorization)?.wallet_uri_base;
        const config = walletUriBase ? { baseUri: walletUriBase } : void 0;
        const currentConnectionGeneration = __privateGet(this, _connectionGeneration);
        const loadingSpinner = new EmbeddedLoadingSpinner();
        try {
          let associating = true;
          let timeout = void 0;
          const useWebSocket = await isLocalWebSocketAvailable();
          const result = await Promise.race([(async () => {
            if (!useWebSocket && !__privateGet(this, _nostrRelay)) await checkLocalNetworkAccessPermission();
          })().then(async () => {
            loadingSpinner.init();
            const { wallet, close } = !useWebSocket && __privateGet(this, _nostrRelay) ? await startNostrScenario({
              ...config,
              connectionType: "local",
              relayDomain: __privateGet(this, _nostrRelay)
            }) : await startScenario(config);
            associating = false;
            loadingSpinner.addEventListener("close", (event) => {
              if (event) close();
            });
            loadingSpinner.open();
            const result2 = await callback(await wallet);
            loadingSpinner.close();
            close();
            return result2;
          }), new Promise((_, reject) => {
            timeout = setTimeout(() => {
              if (associating) reject(new SolanaMobileWalletAdapterError(SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_CANCELLED, "Wallet connection timed out", { event: void 0 }));
            }, WALLET_ASSOCIATION_TIMEOUT);
          })]);
          clearTimeout(timeout);
          return result;
        } catch (e2) {
          loadingSpinner.close();
          if (__privateGet(this, _connectionGeneration) !== currentConnectionGeneration) await new Promise(() => {
          });
          if (e2 instanceof Error && e2.name === "SolanaMobileWalletAdapterError" && e2.code === "ERROR_WALLET_NOT_FOUND") await __privateGet(this, _onWalletNotFound).call(this, this);
          throw e2;
        }
      });
      __privateAdd(this, _assertIsAuthorized, () => {
        if (!__privateGet(this, _authorization)) throw new Error("Wallet not connected");
        return {
          authToken: __privateGet(this, _authorization).auth_token,
          chain: __privateGet(this, _authorization).chain
        };
      });
      __privateAdd(this, _accountsToWalletStandardAccounts, (accounts) => {
        return accounts.map((account) => {
          const publicKey = base64ToUint8Array(account.address);
          return {
            address: base58FromUint8Array(publicKey),
            publicKey,
            label: account.label,
            icon: account.icon,
            chains: account.chains ?? __privateGet(this, _chains),
            features: account.features ?? DEFAULT_FEATURES
          };
        });
      });
      __privateAdd(this, _performSignTransactions, async (transactions) => {
        const { authToken, chain } = __privateGet(this, _assertIsAuthorized).call(this);
        try {
          const base64Transactions = transactions.map((tx) => {
            return base64FromUint8Array(tx);
          });
          return await __privateGet(this, _transact).call(this, async (wallet) => {
            await __privateGet(this, _performReauthorization).call(this, wallet, authToken, chain);
            return (await wallet.signTransactions({ payloads: base64Transactions })).signed_payloads.map(base64ToUint8Array);
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _performSignAndSendTransaction, async (transaction, options) => {
        const { authToken, chain } = __privateGet(this, _assertIsAuthorized).call(this);
        try {
          return await __privateGet(this, _transact).call(this, async (wallet) => {
            const [capabilities] = await Promise.all([wallet.getCapabilities(), __privateGet(this, _performReauthorization).call(this, wallet, authToken, chain)]);
            if (capabilities.supports_sign_and_send_transactions) {
              const base64Transaction = base64FromUint8Array(transaction);
              return (await wallet.signAndSendTransactions({
                ...options,
                payloads: [base64Transaction]
              })).signatures.map(base64ToUint8Array)[0];
            } else throw new Error("connected wallet does not support signAndSendTransaction");
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _signAndSendTransaction, async (...inputs) => {
        const outputs = [];
        for (const input of inputs) {
          const signature = await __privateGet(this, _performSignAndSendTransaction).call(this, input.transaction, input.options);
          outputs.push({ signature });
        }
        return outputs;
      });
      __privateAdd(this, _signTransaction, async (...inputs) => {
        return (await __privateGet(this, _performSignTransactions).call(this, inputs.map(({ transaction }) => transaction))).map((signedTransaction) => {
          return { signedTransaction };
        });
      });
      __privateAdd(this, _signMessage, async (...inputs) => {
        const { authToken, chain } = __privateGet(this, _assertIsAuthorized).call(this);
        const addresses = inputs.map(({ account }) => base64FromUint8Array(new Uint8Array(account.publicKey)));
        const messages = inputs.map(({ message }) => base64FromUint8Array(message));
        try {
          return await __privateGet(this, _transact).call(this, async (wallet) => {
            await __privateGet(this, _performReauthorization).call(this, wallet, authToken, chain);
            return (await wallet.signMessages({
              addresses,
              payloads: messages
            })).signed_payloads.map(base64ToUint8Array).map((signedMessage) => {
              return {
                signedMessage,
                signature: signedMessage.slice(-64)
              };
            });
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _signIn, async (...inputs) => {
        const outputs = [];
        if (inputs.length > 1) for (const input of inputs) outputs.push(await __privateGet(this, _performSignIn).call(this, input));
        else return [await __privateGet(this, _performSignIn).call(this, inputs[0])];
        return outputs;
      });
      __privateAdd(this, _performSignIn, async (input) => {
        __privateSet(this, _connecting, true);
        try {
          const authorizationResult = await __privateGet(this, _performAuthorization).call(this, {
            ...input,
            domain: input?.domain ?? window.location.host
          });
          if (!authorizationResult.sign_in_result) throw new Error("Sign in failed, no sign in result returned by wallet");
          const signedInAddress = authorizationResult.sign_in_result.address;
          const signedInAccount = authorizationResult.accounts.find((acc) => acc.address == signedInAddress);
          return {
            account: {
              ...signedInAccount ?? { address: base58FromUint8Array(base64ToUint8Array(signedInAddress)) },
              publicKey: base64ToUint8Array(signedInAddress),
              chains: signedInAccount?.chains ?? __privateGet(this, _chains),
              features: signedInAccount?.features ?? authorizationResult.capabilities.features
            },
            signedMessage: base64ToUint8Array(authorizationResult.sign_in_result.signed_message),
            signature: base64ToUint8Array(authorizationResult.sign_in_result.signature)
          };
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        } finally {
          __privateSet(this, _connecting, false);
        }
      });
      __privateSet(this, _authorizationCache, config.authorizationCache);
      __privateSet(this, _appIdentity, config.appIdentity);
      __privateSet(this, _chains, config.chains);
      __privateSet(this, _chainSelector, config.chainSelector);
      __privateSet(this, _onWalletNotFound, config.onWalletNotFound);
      __privateSet(this, _nostrRelay, config.nostrRelay);
      __privateSet(this, _optionalFeatures, {
        [SolanaSignAndSendTransaction]: {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signAndSendTransaction: __privateGet(this, _signAndSendTransaction)
        },
        [SolanaSignTransaction]: {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: __privateGet(this, _signTransaction)
        }
      });
    }
    get version() {
      return __privateGet(this, _version);
    }
    get name() {
      return __privateGet(this, _name);
    }
    get url() {
      return __privateGet(this, _url);
    }
    get icon() {
      return __privateGet(this, _icon);
    }
    get chains() {
      return __privateGet(this, _chains);
    }
    get features() {
      return {
        [StandardConnect]: {
          version: "1.0.0",
          connect: __privateGet(this, _connect)
        },
        [StandardDisconnect]: {
          version: "1.0.0",
          disconnect: __privateGet(this, _disconnect)
        },
        [StandardEvents]: {
          version: "1.0.0",
          on: __privateGet(this, _on)
        },
        [SolanaSignMessage]: {
          version: "1.0.0",
          signMessage: __privateGet(this, _signMessage)
        },
        [SolanaSignIn]: {
          version: "1.0.0",
          signIn: __privateGet(this, _signIn)
        },
        ...__privateGet(this, _optionalFeatures)
      };
    }
    get accounts() {
      return __privateGet(this, _authorization)?.accounts ?? [];
    }
    get connected() {
      return !!__privateGet(this, _authorization);
    }
    get isAuthorized() {
      return !!__privateGet(this, _authorization);
    }
    get currentAuthorization() {
      return __privateGet(this, _authorization);
    }
    get cachedAuthorizationResult() {
      return __privateGet(this, _authorizationCache).get();
    }
  }, _listeners = new WeakMap(), _version = new WeakMap(), _name = new WeakMap(), _url = new WeakMap(), _icon = new WeakMap(), _appIdentity = new WeakMap(), _authorization = new WeakMap(), _authorizationCache = new WeakMap(), _connecting = new WeakMap(), _connectionGeneration = new WeakMap(), _chains = new WeakMap(), _chainSelector = new WeakMap(), _optionalFeatures = new WeakMap(), _onWalletNotFound = new WeakMap(), _nostrRelay = new WeakMap(), _on = new WeakMap(), _LocalSolanaMobileWalletAdapterWallet_instances = new WeakSet(), emit_fn = function(event, ...args) {
    __privateGet(this, _listeners)[event]?.forEach((listener) => listener.apply(null, args));
  }, off_fn = function(event, listener) {
    __privateGet(this, _listeners)[event] = __privateGet(this, _listeners)[event]?.filter((existingListener) => listener !== existingListener);
  }, _connect = new WeakMap(), _performAuthorization = new WeakMap(), _handleAuthorizationResult = new WeakMap(), _handleWalletCapabilitiesResult = new WeakMap(), _performReauthorization = new WeakMap(), _disconnect = new WeakMap(), _transact = new WeakMap(), _assertIsAuthorized = new WeakMap(), _accountsToWalletStandardAccounts = new WeakMap(), _performSignTransactions = new WeakMap(), _performSignAndSendTransaction = new WeakMap(), _signAndSendTransaction = new WeakMap(), _signTransaction = new WeakMap(), _signMessage = new WeakMap(), _signIn = new WeakMap(), _performSignIn = new WeakMap(), _a6);
  var _listeners2, _version2, _name2, _url2, _icon2, _appIdentity2, _authorization2, _authorizationCache2, _connecting2, _connectionGeneration2, _chains2, _chainSelector2, _optionalFeatures2, _onWalletNotFound2, _relay, _session, _on2, _RemoteSolanaMobileWalletAdapterWallet_instances, emit_fn2, off_fn2, _connect2, _performAuthorization2, _handleAuthorizationResult2, _handleWalletCapabilitiesResult2, _performReauthorization2, _disconnect2, _transact2, _assertIsAuthorized2, _accountsToWalletStandardAccounts2, _performSignTransactions2, _performSignAndSendTransaction2, _signAndSendTransaction2, _signTransaction2, _signMessage2, _signIn2, _performSignIn2, _a7;
  var RemoteSolanaMobileWalletAdapterWallet = (_a7 = class {
    constructor(config) {
      __privateAdd(this, _RemoteSolanaMobileWalletAdapterWallet_instances);
      __privateAdd(this, _listeners2, {});
      __privateAdd(this, _version2, "1.0.0");
      __privateAdd(this, _name2, SolanaMobileWalletAdapterRemoteWalletName);
      __privateAdd(this, _url2, "https://solanamobile.com/wallets");
      __privateAdd(this, _icon2, icon);
      __privateAdd(this, _appIdentity2);
      __privateAdd(this, _authorization2);
      __privateAdd(this, _authorizationCache2);
      __privateAdd(this, _connecting2, false);
      /**
      * Every time the connection is recycled in some way (eg. `disconnect()` is called)
      * increment this and use it to make sure that `transact` calls from the previous
      * 'generation' don't continue to do work and throw exceptions.
      */
      __privateAdd(this, _connectionGeneration2, 0);
      __privateAdd(this, _chains2, []);
      __privateAdd(this, _chainSelector2);
      __privateAdd(this, _optionalFeatures2);
      __privateAdd(this, _onWalletNotFound2);
      __privateAdd(this, _relay);
      __privateAdd(this, _session);
      __privateAdd(this, _on2, (event, listener) => {
        __privateGet(this, _listeners2)[event]?.push(listener) || (__privateGet(this, _listeners2)[event] = [listener]);
        return () => __privateMethod(this, _RemoteSolanaMobileWalletAdapterWallet_instances, off_fn2).call(this, event, listener);
      });
      __privateAdd(this, _connect2, async (_input = {}) => {
        if (__privateGet(this, _connecting2) || this.connected) return { accounts: this.accounts };
        __privateSet(this, _connecting2, true);
        try {
          await __privateGet(this, _performAuthorization2).call(this);
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        } finally {
          __privateSet(this, _connecting2, false);
        }
        return { accounts: this.accounts };
      });
      __privateAdd(this, _performAuthorization2, async (signInPayload) => {
        try {
          const cachedAuthorizationResult = await __privateGet(this, _authorizationCache2).get();
          if (cachedAuthorizationResult) {
            __privateGet(this, _handleAuthorizationResult2).call(this, cachedAuthorizationResult);
            return cachedAuthorizationResult;
          }
          if (__privateGet(this, _session)) __privateSet(this, _session, void 0);
          const selectedChain = await __privateGet(this, _chainSelector2).select(__privateGet(this, _chains2));
          return await __privateGet(this, _transact2).call(this, async (wallet) => {
            const [capabilities, mwaAuthorizationResult] = await Promise.all([wallet.getCapabilities(), wallet.authorize({
              chain: selectedChain,
              identity: __privateGet(this, _appIdentity2),
              sign_in_payload: signInPayload
            })]);
            const accounts = __privateGet(this, _accountsToWalletStandardAccounts2).call(this, mwaAuthorizationResult.accounts);
            const authorizationResult = {
              ...mwaAuthorizationResult,
              accounts,
              chain: selectedChain,
              capabilities
            };
            Promise.all([
              __privateGet(this, _handleWalletCapabilitiesResult2).call(this, capabilities),
              __privateGet(this, _authorizationCache2).set(authorizationResult),
              __privateGet(this, _handleAuthorizationResult2).call(this, authorizationResult)
            ]);
            return authorizationResult;
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _handleAuthorizationResult2, async (authorization) => {
        const didPublicKeysChange = __privateGet(this, _authorization2) == null || __privateGet(this, _authorization2)?.accounts.length !== authorization.accounts.length || __privateGet(this, _authorization2).accounts.some((account, ii) => account.address !== authorization.accounts[ii].address);
        __privateSet(this, _authorization2, authorization);
        if (didPublicKeysChange) __privateMethod(this, _RemoteSolanaMobileWalletAdapterWallet_instances, emit_fn2).call(this, "change", { accounts: this.accounts });
      });
      __privateAdd(this, _handleWalletCapabilitiesResult2, async (capabilities) => {
        const supportsSignTransaction = capabilities.features.includes("solana:signTransactions");
        const supportsSignAndSendTransaction = capabilities.supports_sign_and_send_transactions || capabilities.features.includes("solana:signAndSendTransaction");
        const didCapabilitiesChange = SolanaSignAndSendTransaction in this.features !== supportsSignAndSendTransaction || SolanaSignTransaction in this.features !== supportsSignTransaction;
        __privateSet(this, _optionalFeatures2, {
          ...supportsSignAndSendTransaction && { [SolanaSignAndSendTransaction]: {
            version: "1.0.0",
            supportedTransactionVersions: capabilities.supported_transaction_versions,
            signAndSendTransaction: __privateGet(this, _signAndSendTransaction2)
          } },
          ...supportsSignTransaction && { [SolanaSignTransaction]: {
            version: "1.0.0",
            supportedTransactionVersions: capabilities.supported_transaction_versions,
            signTransaction: __privateGet(this, _signTransaction2)
          } }
        });
        if (didCapabilitiesChange) __privateMethod(this, _RemoteSolanaMobileWalletAdapterWallet_instances, emit_fn2).call(this, "change", { features: this.features });
      });
      __privateAdd(this, _performReauthorization2, async (wallet, authToken, chain) => {
        try {
          const [capabilities, mwaAuthorizationResult] = await Promise.all([__privateGet(this, _authorization2)?.capabilities ?? await wallet.getCapabilities(), wallet.authorize({
            auth_token: authToken,
            identity: __privateGet(this, _appIdentity2),
            chain
          })]);
          const accounts = __privateGet(this, _accountsToWalletStandardAccounts2).call(this, mwaAuthorizationResult.accounts);
          const authorization = {
            ...mwaAuthorizationResult,
            accounts,
            chain,
            capabilities
          };
          Promise.all([__privateGet(this, _authorizationCache2).set(authorization), __privateGet(this, _handleAuthorizationResult2).call(this, authorization)]);
        } catch (e2) {
          __privateGet(this, _disconnect2).call(this);
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _disconnect2, async () => {
        __privateGet(this, _session)?.close();
        __privateGet(this, _authorizationCache2).clear();
        __privateSet(this, _connecting2, false);
        __privateWrapper(this, _connectionGeneration2)._++;
        __privateSet(this, _authorization2, void 0);
        __privateSet(this, _session, void 0);
        __privateMethod(this, _RemoteSolanaMobileWalletAdapterWallet_instances, emit_fn2).call(this, "change", { accounts: this.accounts });
      });
      __privateAdd(this, _transact2, async (callback) => {
        const walletUriBase = __privateGet(this, _authorization2)?.wallet_uri_base;
        const baseConfig = walletUriBase ? { baseUri: walletUriBase } : void 0;
        const currentConnectionGeneration = __privateGet(this, _connectionGeneration2);
        const modal = new RemoteConnectionModal();
        if (__privateGet(this, _session)) return callback(__privateGet(this, _session).wallet);
        try {
          modal.init();
          modal.open();
          const { associationUrl, close, wallet } = __privateGet(this, _relay).kind == "reflector" ? await startRemoteScenario({
            ...baseConfig,
            remoteHostAuthority: __privateGet(this, _relay).domain
          }) : await startNostrScenario({
            ...baseConfig,
            connectionType: "remote",
            relayDomain: __privateGet(this, _relay).domain
          });
          const removeCloseListener = modal.addEventListener("close", (event) => {
            if (event) close();
          });
          modal.populateQRCode(associationUrl.toString());
          __privateSet(this, _session, {
            close,
            wallet: await wallet
          });
          removeCloseListener();
          modal.close();
          return await callback(__privateGet(this, _session).wallet);
        } catch (e2) {
          modal.close();
          if (__privateGet(this, _connectionGeneration2) !== currentConnectionGeneration) await new Promise(() => {
          });
          if (e2 instanceof Error && e2.name === "SolanaMobileWalletAdapterError" && e2.code === "ERROR_WALLET_NOT_FOUND") await __privateGet(this, _onWalletNotFound2).call(this, this);
          throw e2;
        }
      });
      __privateAdd(this, _assertIsAuthorized2, () => {
        if (!__privateGet(this, _authorization2)) throw new Error("Wallet not connected");
        return {
          authToken: __privateGet(this, _authorization2).auth_token,
          chain: __privateGet(this, _authorization2).chain
        };
      });
      __privateAdd(this, _accountsToWalletStandardAccounts2, (accounts) => {
        return accounts.map((account) => {
          const publicKey = base64ToUint8Array(account.address);
          return {
            address: base58FromUint8Array(publicKey),
            publicKey,
            label: account.label,
            icon: account.icon,
            chains: account.chains ?? __privateGet(this, _chains2),
            features: account.features ?? DEFAULT_FEATURES
          };
        });
      });
      __privateAdd(this, _performSignTransactions2, async (transactions) => {
        const { authToken, chain } = __privateGet(this, _assertIsAuthorized2).call(this);
        try {
          return await __privateGet(this, _transact2).call(this, async (wallet) => {
            await __privateGet(this, _performReauthorization2).call(this, wallet, authToken, chain);
            return (await wallet.signTransactions({ payloads: transactions.map(base64FromUint8Array) })).signed_payloads.map(base64ToUint8Array);
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _performSignAndSendTransaction2, async (transaction, options) => {
        const { authToken, chain } = __privateGet(this, _assertIsAuthorized2).call(this);
        try {
          return await __privateGet(this, _transact2).call(this, async (wallet) => {
            const [capabilities] = await Promise.all([wallet.getCapabilities(), __privateGet(this, _performReauthorization2).call(this, wallet, authToken, chain)]);
            if (capabilities.supports_sign_and_send_transactions) return (await wallet.signAndSendTransactions({
              ...options,
              payloads: [base64FromUint8Array(transaction)]
            })).signatures.map(base64ToUint8Array)[0];
            else throw new Error("connected wallet does not support signAndSendTransaction");
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _signAndSendTransaction2, async (...inputs) => {
        const outputs = [];
        for (const input of inputs) {
          const signature = await __privateGet(this, _performSignAndSendTransaction2).call(this, input.transaction, input.options);
          outputs.push({ signature });
        }
        return outputs;
      });
      __privateAdd(this, _signTransaction2, async (...inputs) => {
        return (await __privateGet(this, _performSignTransactions2).call(this, inputs.map(({ transaction }) => transaction))).map((signedTransaction) => {
          return { signedTransaction };
        });
      });
      __privateAdd(this, _signMessage2, async (...inputs) => {
        const { authToken, chain } = __privateGet(this, _assertIsAuthorized2).call(this);
        const addresses = inputs.map(({ account }) => base64FromUint8Array(new Uint8Array(account.publicKey)));
        const messages = inputs.map(({ message }) => base64FromUint8Array(message));
        try {
          return await __privateGet(this, _transact2).call(this, async (wallet) => {
            await __privateGet(this, _performReauthorization2).call(this, wallet, authToken, chain);
            return (await wallet.signMessages({
              addresses,
              payloads: messages
            })).signed_payloads.map(base64ToUint8Array).map((signedMessage) => {
              return {
                signedMessage,
                signature: signedMessage.slice(-64)
              };
            });
          });
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        }
      });
      __privateAdd(this, _signIn2, async (...inputs) => {
        const outputs = [];
        if (inputs.length > 1) for (const input of inputs) outputs.push(await __privateGet(this, _performSignIn2).call(this, input));
        else return [await __privateGet(this, _performSignIn2).call(this, inputs[0])];
        return outputs;
      });
      __privateAdd(this, _performSignIn2, async (input) => {
        __privateSet(this, _connecting2, true);
        try {
          const authorizationResult = await __privateGet(this, _performAuthorization2).call(this, {
            ...input,
            domain: input?.domain ?? window.location.host
          });
          if (!authorizationResult.sign_in_result) throw new Error("Sign in failed, no sign in result returned by wallet");
          const signedInAddress = authorizationResult.sign_in_result.address;
          const signedInAccount = authorizationResult.accounts.find((acc) => acc.address == signedInAddress);
          return {
            account: {
              ...signedInAccount ?? { address: base58FromUint8Array(base64ToUint8Array(signedInAddress)) },
              publicKey: base64ToUint8Array(signedInAddress),
              chains: signedInAccount?.chains ?? __privateGet(this, _chains2),
              features: signedInAccount?.features ?? authorizationResult.capabilities.features
            },
            signedMessage: base64ToUint8Array(authorizationResult.sign_in_result.signed_message),
            signature: base64ToUint8Array(authorizationResult.sign_in_result.signature)
          };
        } catch (e2) {
          throw new Error(getErrorMessage2(e2), { cause: e2 });
        } finally {
          __privateSet(this, _connecting2, false);
        }
      });
      __privateSet(this, _authorizationCache2, config.authorizationCache);
      __privateSet(this, _appIdentity2, config.appIdentity);
      __privateSet(this, _chains2, config.chains);
      __privateSet(this, _chainSelector2, config.chainSelector);
      __privateSet(this, _relay, "remoteHostAuthority" in config ? {
        kind: "reflector",
        domain: config.remoteHostAuthority
      } : {
        kind: "nostr",
        domain: config.nostrRelay
      });
      __privateSet(this, _onWalletNotFound2, config.onWalletNotFound);
      __privateSet(this, _optionalFeatures2, {
        [SolanaSignAndSendTransaction]: {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signAndSendTransaction: __privateGet(this, _signAndSendTransaction2)
        },
        [SolanaSignTransaction]: {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: __privateGet(this, _signTransaction2)
        }
      });
    }
    get version() {
      return __privateGet(this, _version2);
    }
    get name() {
      return __privateGet(this, _name2);
    }
    get url() {
      return __privateGet(this, _url2);
    }
    get icon() {
      return __privateGet(this, _icon2);
    }
    get chains() {
      return __privateGet(this, _chains2);
    }
    get features() {
      return {
        [StandardConnect]: {
          version: "1.0.0",
          connect: __privateGet(this, _connect2)
        },
        [StandardDisconnect]: {
          version: "1.0.0",
          disconnect: __privateGet(this, _disconnect2)
        },
        [StandardEvents]: {
          version: "1.0.0",
          on: __privateGet(this, _on2)
        },
        [SolanaSignMessage]: {
          version: "1.0.0",
          signMessage: __privateGet(this, _signMessage2)
        },
        [SolanaSignIn]: {
          version: "1.0.0",
          signIn: __privateGet(this, _signIn2)
        },
        ...__privateGet(this, _optionalFeatures2)
      };
    }
    get accounts() {
      return __privateGet(this, _authorization2)?.accounts ?? [];
    }
    get connected() {
      return !!__privateGet(this, _session) && !!__privateGet(this, _authorization2);
    }
    get isAuthorized() {
      return !!__privateGet(this, _authorization2);
    }
    get currentAuthorization() {
      return __privateGet(this, _authorization2);
    }
    get cachedAuthorizationResult() {
      return __privateGet(this, _authorizationCache2).get();
    }
  }, _listeners2 = new WeakMap(), _version2 = new WeakMap(), _name2 = new WeakMap(), _url2 = new WeakMap(), _icon2 = new WeakMap(), _appIdentity2 = new WeakMap(), _authorization2 = new WeakMap(), _authorizationCache2 = new WeakMap(), _connecting2 = new WeakMap(), _connectionGeneration2 = new WeakMap(), _chains2 = new WeakMap(), _chainSelector2 = new WeakMap(), _optionalFeatures2 = new WeakMap(), _onWalletNotFound2 = new WeakMap(), _relay = new WeakMap(), _session = new WeakMap(), _on2 = new WeakMap(), _RemoteSolanaMobileWalletAdapterWallet_instances = new WeakSet(), emit_fn2 = function(event, ...args) {
    __privateGet(this, _listeners2)[event]?.forEach((listener) => listener.apply(null, args));
  }, off_fn2 = function(event, listener) {
    __privateGet(this, _listeners2)[event] = __privateGet(this, _listeners2)[event]?.filter((existingListener) => listener !== existingListener);
  }, _connect2 = new WeakMap(), _performAuthorization2 = new WeakMap(), _handleAuthorizationResult2 = new WeakMap(), _handleWalletCapabilitiesResult2 = new WeakMap(), _performReauthorization2 = new WeakMap(), _disconnect2 = new WeakMap(), _transact2 = new WeakMap(), _assertIsAuthorized2 = new WeakMap(), _accountsToWalletStandardAccounts2 = new WeakMap(), _performSignTransactions2 = new WeakMap(), _performSignAndSendTransaction2 = new WeakMap(), _signAndSendTransaction2 = new WeakMap(), _signTransaction2 = new WeakMap(), _signMessage2 = new WeakMap(), _signIn2 = new WeakMap(), _performSignIn2 = new WeakMap(), _a7);
  function registerMwa(config) {
    if (typeof window === "undefined") {
      console.warn(`MWA not registered: no window object`);
      return;
    }
    if (!window.isSecureContext) {
      console.warn(`MWA not registered: secure context required (https)`);
      return;
    }
    const userAgent = navigator.userAgent;
    if (getIsLocalAssociationSupported() && (!isWebView(userAgent) || isSolanaMobileWebShell(userAgent))) registerWallet(new LocalSolanaMobileWalletAdapterWallet(config));
    else if (getIsRemoteAssociationSupported() && ("nostrRelay" in config || config.remoteHostAuthority !== void 0)) {
      if ("nostrRelay" in config) registerWallet(new RemoteSolanaMobileWalletAdapterWallet({
        ...config,
        nostrRelay: config.nostrRelay
      }));
      else registerWallet(new RemoteSolanaMobileWalletAdapterWallet({
        ...config,
        remoteHostAuthority: config.remoteHostAuthority
      }));
    } else console.warn(`MWA not registered: device or environment not supported`);
  }

  // src/lib/android-shell.ts
  var ANDROID_SHELL_MARKER = "Solana Mobile Web Shell";
  function isAndroidShell(userAgent) {
    return userAgent.includes(ANDROID_SHELL_MARKER);
  }
  function androidWalletRegistration(origin) {
    const url = new URL(origin);
    if (url.protocol !== "https:") throw new Error("Mobile Wallet Adapter requires the hosted https origin.");
    return {
      appIdentity: { name: "SuperTab", uri: url.origin, icon: "favicon.ico" },
      chains: ["solana:mainnet", "solana:devnet"]
    };
  }

  // src/lib/mwa-bootstrap.ts
  if (typeof window !== "undefined" && !window.__supertabMwaRegistered && window.isSecureContext && isAndroidShell(navigator.userAgent)) {
    registerMwa({
      ...androidWalletRegistration(window.location.origin),
      authorizationCache: createDefaultAuthorizationCache(),
      chainSelector: createDefaultChainSelector(),
      onWalletNotFound: async () => {
        window.dispatchEvent(new CustomEvent("supertab-wallet-unavailable"));
      }
    });
    window.__supertabMwaRegistered = true;
  }
})();
/*! Bundled license information:

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
