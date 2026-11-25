import { ArrowRight, UserRound } from "lucide-react";
import { useTranslations } from "@/src/i18n/provider";
import styles from "@/app/prototype/prototype.module.css";
import requestStyles from "./prototype-requests.module.css";

export type PrototypeRequest = {
  id: number;
  title: string;
  detail: string;
  state: "review" | "proposed" | "confirmed" | "completed";
  person: string;
  date: string;
};

export function PrototypeRequests({
  requests,
  hasAccount,
  requestsLoading,
  requestsLoadError,
  onNewRequest,
  onRetry,
  onOpen,
}: {
  requests: PrototypeRequest[];
  hasAccount: boolean;
  requestsLoading: boolean;
  requestsLoadError: boolean;
  onNewRequest: () => void;
  onRetry: () => void;
  onOpen: (message: string) => void;
}) {
  const t = useTranslations();
  return (
    <section className={styles.listScreen}>
      <div className={styles.screenHeading}>
        <div>
          <h1>{t("prototypeRequestsTitle")}</h1>
        </div>
        {requests.length > 0 && (
          <button className={styles.primaryButton} onClick={onNewRequest}>
            {t("prototypeSubmitRequest")} <ArrowRight size={17} />
          </button>
        )}
      </div>
      {hasAccount && requestsLoading ? (
        <p role="status">{t("prototypeRequestsLoading")}</p>
      ) : null}
      {hasAccount && requestsLoadError ? (
        <div role="alert" className={styles.formNotice}>
          <p>{t("prototypeRequestsLoadError")}</p>
          <button className={styles.textButton} onClick={onRetry}>
            {t("prototypeRetry")}
          </button>
        </div>
      ) : null}
      {!requestsLoading && !requestsLoadError && requests.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>{t("prototypeNoRequestsTitle")}</h2>
          <p>{t("prototypeNoRequestsText")}</p>
          <button className={styles.primaryButton} onClick={onNewRequest}>
            {t("prototypeDescribeTask")} <ArrowRight size={16} />
          </button>
        </div>
      ) : null}
      <div className={requestStyles.requestList}>
        {requests.map((request) => (
          <RequestDetail
            key={request.id}
            request={request}
            onOpen={() =>
              onOpen(`${requestStateLabel(request.state, t)} · ${request.date}`)
            }
          />
        ))}
      </div>
    </section>
  );
}

function RequestDetail({
  request,
  onOpen,
}: {
  request: PrototypeRequest;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const stateLabel = requestStateLabel(request.state, t);
  return (
    <article className={requestStyles.requestDetail}>
      <div className={requestStyles.requestDetailTop}>
        <span
          className={
            request.state === "proposed"
              ? requestStyles.requestStateBlue
              : requestStyles.requestStateNeutral
          }
        >
          <span /> {stateLabel}
        </span>
        <span>{request.date}</span>
      </div>
      <h2>{request.title}</h2>
      <p>{request.detail}</p>
      <div className={requestStyles.requestDetailBottom}>
        <span>
          <UserRound size={15} /> {request.person}
        </span>
        <button className={styles.textButton} onClick={onOpen}>
          {t("prototypeOpenRequest")} <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function requestStateLabel(
  state: PrototypeRequest["state"],
  t: ReturnType<typeof useTranslations>,
) {
  return {
    review: t("prototypeStatusReview"),
    proposed: t("prototypeStatusTimeProposed"),
    confirmed: t("prototypeStatusConfirmed"),
    completed: t("prototypeStatusCompleted"),
  }[state];
}
