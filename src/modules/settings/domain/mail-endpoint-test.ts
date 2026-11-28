export type MailEndpointTestResult = {
  success: boolean;
  message: string;
  httpStatus?: number;
  providerMessageId?: string;
};
