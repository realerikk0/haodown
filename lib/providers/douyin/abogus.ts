import { sm3 } from "sm-crypto";

const A_BOGUS_STRINGS = {
  s4: "Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe",
} as const;

const REGISTERS = [
  1937774191,
  1226093241,
  388252375,
  3666478592,
  2842636476,
  372324522,
  3817729613,
  2969243214,
];

const ARGUMENTS = [0, 1, 14];

const UA_CODE = [
  76,
  98,
  15,
  131,
  97,
  245,
  224,
  133,
  122,
  199,
  241,
  166,
  79,
  34,
  90,
  191,
  128,
  126,
  122,
  98,
  66,
  11,
  14,
  40,
  49,
  110,
  110,
  173,
  67,
  96,
  138,
  252,
];

const BROWSER_INFO =
  "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|MacIntel";

function toUint32(value: number) {
  return value >>> 0;
}

function rotateLeft(value: number, shift: number) {
  const normalizedShift = shift % 32;
  if (normalizedShift === 0) {
    return toUint32(value);
  }

  return toUint32((value << normalizedShift) | (value >>> (32 - normalizedShift)));
}

function chooseConstant(index: number) {
  return index >= 0 && index < 16 ? 2043430169 : 2055708042;
}

function he(index: number, left: number, middle: number, right: number) {
  if (index >= 0 && index < 16) {
    return toUint32(left ^ middle ^ right);
  }

  return toUint32((left & middle) | (left & right) | (middle & right));
}

function ve(index: number, left: number, middle: number, right: number) {
  if (index >= 0 && index < 16) {
    return toUint32(left ^ middle ^ right);
  }

  return toUint32((left & middle) | (~left & right));
}

function fromCharCode(values: number[]) {
  return String.fromCharCode(...values);
}

function decodeString(input: string) {
  return input.replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function stringToCharCodes(input: string) {
  return Array.from(input, (character) => character.charCodeAt(0));
}

function randomList(
  input?: number,
  highMask = 170,
  lowMask = 85,
  highValue = 0,
  lowValue = 0,
  midHighValue = 0,
  midLowValue = 0,
) {
  const seed = input ?? Math.random() * 10_000;
  const bytes = [seed, Math.trunc(seed) & 255, Math.trunc(seed) >> 8];
  const first = (bytes[1] & highMask) | highValue;
  const second = (bytes[1] & lowMask) | lowValue;
  const third = (bytes[2] & highMask) | midHighValue;
  const fourth = (bytes[2] & lowMask) | midLowValue;

  return [first, second, third, fourth];
}

function list1(randomNumber?: number) {
  return randomList(randomNumber, 170, 85, 1, 2, 5, 45 & 170);
}

function list2(randomNumber?: number) {
  return randomList(randomNumber, 170, 85, 1, 0, 0, 0);
}

function list3(randomNumber?: number) {
  return randomList(randomNumber, 170, 85, 1, 0, 5, 0);
}

function list4(values: number[]) {
  return [
    44,
    values[0],
    0,
    0,
    0,
    0,
    24,
    values[1],
    values[12],
    0,
    values[2],
    values[3],
    0,
    0,
    0,
    1,
    0,
    239,
    values[4],
    values[13],
    values[5],
    values[6],
    0,
    0,
    0,
    0,
    values[7],
    0,
    0,
    14,
    values[8],
    values[9],
    0,
    values[10],
    values[11],
    3,
    values[14],
    1,
    values[15],
    1,
    values[16],
    0,
    0,
    0,
  ];
}

function endCheckNum(values: number[]) {
  return values.reduce((result, value) => result ^ value, 0);
}

function generateF(values: number[]) {
  const result = new Array<number>(132).fill(0);

  for (let index = 0; index < 16; index += 1) {
    result[index] = toUint32(
      (values[4 * index] << 24) |
        (values[4 * index + 1] << 16) |
        (values[4 * index + 2] << 8) |
        values[4 * index + 3],
    );
  }

  for (let index = 16; index < 68; index += 1) {
    let value =
      result[index - 16] ^ result[index - 9] ^ rotateLeft(result[index - 3], 15);
    value = value ^ rotateLeft(value, 15) ^ rotateLeft(value, 23);
    result[index] = toUint32(value ^ rotateLeft(result[index - 13], 7) ^ result[index - 6]);
  }

  for (let index = 68; index < 132; index += 1) {
    result[index] = toUint32(result[index - 68] ^ result[index - 64]);
  }

  return result;
}

function regToArray(registers: number[]) {
  const output = new Array<number>(32).fill(0);

  for (let index = 0; index < 8; index += 1) {
    let current = registers[index];
    output[4 * index + 3] = current & 255;
    current >>>= 8;
    output[4 * index + 2] = current & 255;
    current >>>= 8;
    output[4 * index + 1] = current & 255;
    current >>>= 8;
    output[4 * index] = current & 255;
  }

  return output;
}

function rc4Encrypt(plaintext: string, key: string) {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;

  for (let index = 0; index < 256; index += 1) {
    j = (j + state[index] + key.charCodeAt(index % key.length)) % 256;
    [state[index], state[j]] = [state[j], state[index]];
  }

  let i = 0;
  j = 0;
  const output: string[] = [];

  for (let index = 0; index < plaintext.length; index += 1) {
    i = (i + 1) % 256;
    j = (j + state[i]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
    const pointer = (state[i] + state[j]) % 256;
    output.push(String.fromCharCode(state[pointer] ^ plaintext.charCodeAt(index)));
  }

  return output.join("");
}

function sm3ToArray(data: string | number[]) {
  const buffer =
    typeof data === "string"
      ? Buffer.from(data, "utf8")
      : Buffer.from(Uint8Array.from(data));
  const digestHex = sm3(Array.from(buffer.values()));
  return Array.from(
    { length: digestHex.length / 2 },
    (_, index) => Number.parseInt(digestHex.slice(index * 2, index * 2 + 2), 16),
  );
}

function generateResult(source: string) {
  const alphabet = A_BOGUS_STRINGS.s4;
  const output: string[] = [];

  for (let index = 0; index < source.length; index += 3) {
    let block = source.charCodeAt(index) << 16;
    if (index + 1 < source.length) {
      block |= source.charCodeAt(index + 1) << 8;
    }
    if (index + 2 < source.length) {
      block |= source.charCodeAt(index + 2);
    }

    for (const [shift, mask] of [
      [18, 0xfc0000],
      [12, 0x03f000],
      [6, 0x0fc0],
      [0, 0x3f],
    ] as const) {
      if (shift === 6 && index + 1 >= source.length) {
        break;
      }
      if (shift === 0 && index + 2 >= source.length) {
        break;
      }
      output.push(alphabet[(block & mask) >> shift]);
    }
  }

  output.push("=".repeat((4 - (output.length % 4)) % 4));
  return output.join("");
}

class ABogusGenerator {
  private chunk: number[] = [];

  private size = 0;

  private registers = [...REGISTERS];

  private readonly browserCode = stringToCharCodes(BROWSER_INFO);

  private readonly browserLength = BROWSER_INFO.length;

  private reset() {
    this.chunk = [];
    this.size = 0;
    this.registers = [...REGISTERS];
  }

  private write(input: string | number[]) {
    this.size = input.length;
    let bytes = input;
    if (typeof bytes === "string") {
      bytes = stringToCharCodes(decodeString(bytes));
    }

    if (bytes.length <= 64) {
      this.chunk = [...bytes];
      return;
    }

    for (let index = 0; index + 64 < bytes.length; index += 64) {
      this.compress(bytes.slice(index, index + 64));
    }

    this.chunk = bytes.slice(Math.floor((bytes.length - 1) / 64) * 64);
  }

  private fill(length = 60) {
    const size = 8 * this.size;
    this.chunk.push(128);
    while (this.chunk.length < length) {
      this.chunk.push(0);
    }
    for (let index = 0; index < 4; index += 1) {
      this.chunk.push((size >> (8 * (3 - index))) & 255);
    }
  }

  private compress(chunk: number[]) {
    const fValues = generateF(chunk);
    const current = [...this.registers];

    for (let index = 0; index < 64; index += 1) {
      let c =
        rotateLeft(current[0], 12) + current[4] + rotateLeft(chooseConstant(index), index);
      c = toUint32(c);
      c = rotateLeft(c, 7);
      const s = toUint32(c ^ rotateLeft(current[0], 12));

      let u = he(index, current[0], current[1], current[2]);
      u = toUint32(u + current[3] + s + fValues[index + 68]);

      let b = ve(index, current[4], current[5], current[6]);
      b = toUint32(b + current[7] + c + fValues[index]);

      current[3] = current[2];
      current[2] = rotateLeft(current[1], 9);
      current[1] = current[0];
      current[0] = u;
      current[7] = current[6];
      current[6] = rotateLeft(current[5], 19);
      current[5] = current[4];
      current[4] = toUint32(b ^ rotateLeft(b, 9) ^ rotateLeft(b, 17));
    }

    for (let index = 0; index < 8; index += 1) {
      this.registers[index] = toUint32(this.registers[index] ^ current[index]);
    }
  }

  private sum(value: string | number[]) {
    this.reset();
    this.write(value);
    this.fill(60);
    this.compress(this.chunk);
    return regToArray(this.registers);
  }

  private generateString1(
    randomNumber1?: number,
    randomNumber2?: number,
    randomNumber3?: number,
  ) {
    return (
      fromCharCode(list1(randomNumber1)) +
      fromCharCode(list2(randomNumber2)) +
      fromCharCode(list3(randomNumber3))
    );
  }

  private generateMethodCode(method = "GET") {
    return sm3ToArray(sm3ToArray(`${method}cus`));
  }

  private generateParamsCode(params: string) {
    return sm3ToArray(sm3ToArray(`${params}cus`));
  }

  private generateString2List(
    urlParams: string,
    method = "GET",
    startTime = 0,
    endTime = 0,
  ) {
    const actualStartTime = startTime || Date.now();
    const actualEndTime =
      endTime || actualStartTime + Math.floor(Math.random() * 5) + 4;
    const paramsArray = this.generateParamsCode(urlParams);
    const methodArray = this.generateMethodCode(method);

    return list4([
      (actualEndTime >> 24) & 255,
      paramsArray[21],
      UA_CODE[23],
      (actualEndTime >> 16) & 255,
      paramsArray[22],
      UA_CODE[24],
      (actualEndTime >> 8) & 255,
      actualEndTime & 255,
      (actualStartTime >> 24) & 255,
      (actualStartTime >> 16) & 255,
      (actualStartTime >> 8) & 255,
      actualStartTime & 255,
      methodArray[21],
      methodArray[22],
      Math.trunc(actualEndTime / 256 / 256 / 256 / 256),
      Math.trunc(actualStartTime / 256 / 256 / 256 / 256),
      this.browserLength,
    ]);
  }

  private generateString2(
    urlParams: string,
    method = "GET",
    startTime = 0,
    endTime = 0,
  ) {
    const values = this.generateString2List(urlParams, method, startTime, endTime);
    const checksum = endCheckNum(values);
    values.push(...this.browserCode);
    values.push(checksum);
    return rc4Encrypt(fromCharCode(values), "y");
  }

  getValue(
    urlParams: URLSearchParams | string,
    method = "GET",
    startTime = 0,
    endTime = 0,
  ) {
    const normalizedParams =
      typeof urlParams === "string" ? urlParams : urlParams.toString();
    const string1 = this.generateString1();
    const string2 = this.generateString2(normalizedParams, method, startTime, endTime);
    return generateResult(string1 + string2);
  }
}

export function createDouyinABogus(
  params: URLSearchParams | string,
  method = "GET",
) {
  return encodeURIComponent(new ABogusGenerator().getValue(params, method));
}

export function buildDouyinFalseMsToken() {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let output = "";
  for (let index = 0; index < 126; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${output}==`;
}

export function buildDouyinDetailParams(awemeId: string, msToken = "") {
  return new URLSearchParams([
    ["device_platform", "webapp"],
    ["aid", "6383"],
    ["channel", "channel_pc_web"],
    ["pc_client_type", "1"],
    ["version_code", "290100"],
    ["version_name", "29.1.0"],
    ["cookie_enabled", "true"],
    ["screen_width", "1920"],
    ["screen_height", "1080"],
    ["browser_language", "zh-CN"],
    ["browser_platform", "Win32"],
    ["browser_name", "Chrome"],
    ["browser_version", "130.0.0.0"],
    ["browser_online", "true"],
    ["engine_name", "Blink"],
    ["engine_version", "130.0.0.0"],
    ["os_name", "Windows"],
    ["os_version", "10"],
    ["cpu_core_num", "12"],
    ["device_memory", "8"],
    ["platform", "PC"],
    ["downlink", "10"],
    ["effective_type", "4g"],
    ["from_user_page", "1"],
    ["locate_query", "false"],
    ["need_time_list", "1"],
    ["pc_libra_divert", "Windows"],
    ["publish_video_strategy_type", "2"],
    ["round_trip_time", "0"],
    ["show_live_replay_strategy", "1"],
    ["time_list_query", "0"],
    ["whale_cut_token", ""],
    ["update_version_code", "170400"],
    ["msToken", msToken],
    ["aweme_id", awemeId],
  ]);
}

export function debugDouyinSm3Available() {
  return sm3("ok").length > 0;
}
