import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  listEmailTemplates: vi.fn(),
  listBirthdayEmailRecipients: vi.fn(),
  getEmailDeliveryByKey: vi.fn(),
  createEmailDelivery: vi.fn(),
  updateEmailDelivery: vi.fn(),
  appendOperationAuditEvent: vi.fn(),
};
const graphMock = { sendMicrosoftGraphMail: vi.fn() };

vi.mock("../db", () => dbMock);
vi.mock("../integrations/microsoftGraphMail", () => graphMock);
const { dispatchBirthdayCongratulations } = await import("./birthdayDispatch");

describe("birthday congratulations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.listEmailTemplates.mockResolvedValue([{ id: 9, eventType: "birthday_congratulation", isActive: true, subjectTemplate: "Happy birthday, {{firstName}}", bodyTemplate: "Congratulations {{displayName}}" }]);
    dbMock.listBirthdayEmailRecipients.mockResolvedValue([{ id: 31, displayName: "Ada Lovelace", email: "ada@example.test" }]);
    dbMock.getEmailDeliveryByKey.mockResolvedValue(undefined);
    dbMock.createEmailDelivery.mockResolvedValue({ id: 88, subject: "Happy birthday, Ada", bodyText: "Congratulations Ada Lovelace" });
    graphMock.sendMicrosoftGraphMail.mockResolvedValue({ status: "unconfigured", message: "Graph Mail is not configured." });
  });

  it("renders allowed birthday tokens and records one delivery key per employee/template/year", async () => {
    const result = await dispatchBirthdayCongratulations(new Date("2026-08-14T09:00:00Z"));
    expect(result).toEqual({ status: "completed", processed: 1, sent: 0 });
    expect(dbMock.createEmailDelivery).toHaveBeenCalledWith(expect.objectContaining({ deliveryKey: "birthday:9:31:2026", recipientsJson: JSON.stringify(["ada@example.test"]), subject: "Happy birthday, Ada" }));
    expect(dbMock.appendOperationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "birthday_email_unconfigured", actorUserId: null }));
  });

  it("skips an already-recorded delivery key when a scheduler retry occurs", async () => {
    dbMock.getEmailDeliveryByKey.mockResolvedValue({ id: 88 });
    const result = await dispatchBirthdayCongratulations(new Date("2026-08-14T09:00:00Z"));
    expect(result).toEqual({ status: "completed", processed: 1, sent: 0 });
    expect(dbMock.createEmailDelivery).not.toHaveBeenCalled();
  });
});
