declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };

  export type RequestDetails = {
    endpoint: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeout?: number;
  };

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  export function generateRequestDetails(
    subscription: PushSubscription,
    payload?: string,
    options?: Record<string, unknown>,
  ): RequestDetails;
}
