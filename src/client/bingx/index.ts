import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import crypto from "crypto";
import qs from "qs";
import JSONBig from "json-bigint";

interface BingXClientConfig {
  apiKey?: string;
  apiSecret?: string;
  baseURL?: string;
  timeout?: number;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  isPrivate?: boolean;
}

type BingXResponse<T = unknown> = {
  code: number;
  msg: string;
  data: T;
  success: boolean;
};

export class BingXClient {
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(config: BingXClientConfig = {}) {
    this.apiKey = config.apiKey || "";
    this.apiSecret = config.apiSecret || "";

    this.client = axios.create({
      baseURL: config.baseURL || "https://open-api.bingx.com",
      timeout: config.timeout || 5000,
      // transformResponse is called once per request
      transformResponse: [(data) => this.transformResponse(data)]
    });
  }

  /**
   * Make sure objects have a normal prototype so they won't print as [Object: null prototype].
   */
  private restorePrototype(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.restorePrototype(item));
    }
    if (obj && typeof obj === "object") {
      // If the prototype is null, give it a normal object prototype
      if (Object.getPrototypeOf(obj) === null) {
        Object.setPrototypeOf(obj, Object.prototype);
      }
      for (const key of Object.keys(obj)) {
        (obj as Record<string, unknown>)[key] = this.restorePrototype(
          (obj as Record<string, unknown>)[key]
        );
      }
    }
    return obj;
  }

  /**
   * Parse the top-level response. Then parse nested JSON in `order.stopLoss` / `order.takeProfit` if they're strings.
   * Finally, restore prototypes so logs won't show [Object: null prototype].
   */
  private transformResponse(data: string): unknown {
    // Attempt to parse the top-level JSON
    let parsed: any;
    try {
      parsed = JSONBig({ useNativeBigInt: true, alwaysParseAsBig: true }).parse(data);
    } catch (err) {
      // If we can't parse at all, just return the raw string. We'll handle it in normalizeResponse.
      return data;
    }

    // If there's an `order`, parse its nested fields if they're JSON strings
    if (parsed?.data?.order) {
      const order = parsed.data.order;
      if (typeof order.takeProfit === "string") {
        try {
          order.takeProfit = JSONBig({ useNativeBigInt: true, alwaysParseAsBig: true }).parse(
            order.takeProfit
          );
        } catch {
          // leave as string if nested parse fails
        }
      }
      if (typeof order.stopLoss === "string") {
        try {
          order.stopLoss = JSONBig({ useNativeBigInt: true, alwaysParseAsBig: true }).parse(
            order.stopLoss
          );
        } catch {
          // leave as string if nested parse fails
        }
      }
    }

    // Restore prototypes so you don't get [Object: null prototype]
    parsed = this.restorePrototype(parsed);

    return parsed;
  }

  private normalizeResponse<T>(data: unknown): BingXResponse<T> {
    // If data is a string, attempt to parse it.
    if (typeof data === "string") {
      try {
        data = JSONBig({ useNativeBigInt: true, alwaysParseAsBig: true }).parse(data);
      } catch (err) {
        return {
          code: -1,
          msg: "Response parsing failed",
          data: data as T,
          success: false
        };
      }
    }
  
    const parsed = data as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return {
        code: -1,
        msg: "Invalid response format",
        data: parsed as T,
        success: false
      };
    }
  
    const success = parsed.data !== undefined;
    const code = success ? 0 : -1;
    const msg = typeof parsed.msg === "string" ? parsed.msg : "";
  
    return {
      code,
      msg,
      data: parsed.data as T,
      success
    };
  }

  private generateSignature(payload: string): string {
    return crypto.createHmac("sha256", this.apiSecret).update(payload).digest("hex");
  }

  private buildQueryString(params: Record<string, unknown>): string {
    return qs.stringify(params, {
      sort: (a, b) => a.localeCompare(b),
      encoder: encodeURIComponent,
      arrayFormat: "repeat"
    });
  }

  private signRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    payload: { params: Record<string, unknown>; data: Record<string, unknown>; timestamp: number }
  ) {
    const queryParams =
      method === "GET"
        ? { ...payload.params, timestamp: payload.timestamp }
        : { ...payload.data, timestamp: payload.timestamp };

    const queryString = this.buildQueryString(queryParams);
    return {
      queryParams,
      signature: this.generateSignature(queryString),
      queryString
    };
  }

  private validatePrivateRequest(): void {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Missing API credentials for private request");
    }
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data as Record<string, unknown> | undefined;
      const message = [
        `BingX API Error: ${responseData?.msg || error.message}`,
        `Status: ${error.response?.status || "No status"}`,
        `Code: ${responseData?.code || "No error code"}`
      ].join(" | ");
      throw new Error(message);
    }
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }

  // ---- Public request methods ----
  public async request<T = unknown>(options: RequestOptions): Promise<BingXResponse<T>> {
    const { method = "GET", url, params = {}, data = {}, isPrivate = false } = options;
    const config: AxiosRequestConfig = { method, url };
  
    try {
      if (isPrivate) {
        this.validatePrivateRequest();
        const timestamp = Date.now();
        const { queryParams, signature, queryString } = this.signRequest(method, {
          params,
          data,
          timestamp
        });
  
        config.headers = {
          ...config.headers,
          "X-BX-APIKEY": this.apiKey,
          ...(method !== "GET" && { "Content-Type": "application/x-www-form-urlencoded" })
        };
  
        // Treat GET and DELETE the same: send parameters in the URL.
        if (method === "GET" || method === "DELETE") {
          config.params = { ...queryParams, signature };
        } else {
          config.data = `${queryString}&signature=${encodeURIComponent(signature)}`;
        }
      } else {
        if (method === "GET") {
          config.params = params;
        } else {
          config.data = data;
        }
      }
  
      const response = await this.client(config);
      // console.log("Response data:", JSON.stringify(response, null, 2));
      // return this.normalizeResponse<T>(response.data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Simplified HTTP helper methods
  public get<T = unknown>(url: string, params?: Record<string, unknown>, isPrivate = false) {
    return this.request<T>({ method: "GET", url, params, isPrivate });
  }

  public post<T = unknown>(url: string, data?: Record<string, unknown>, isPrivate = true) {
    return this.request<T>({ method: "POST", url, data, isPrivate });
  }

  public put<T = unknown>(url: string, data?: Record<string, unknown>, isPrivate = true) {
    return this.request<T>({ method: "PUT", url, data, isPrivate });
  }

  public delete<T = unknown>(url: string, data?: Record<string, unknown>, isPrivate = true) {
    return this.request<T>({ method: "DELETE", url, data, isPrivate });
  }
}