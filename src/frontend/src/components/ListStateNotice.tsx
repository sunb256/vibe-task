import { Notice } from "./Notice";

type ListStateNoticeProps = {
  error: string;
  isLoading: boolean;
  hasItems: boolean;
  hasVisibleItems: boolean;
  loadingMessage: string;
  emptyMessage: string;
  noMatchMessage: string;
};

export function ListStateNotice(props: ListStateNoticeProps) {
  return (
    <>
      {props.error ? <Notice tone="error" message={props.error} /> : null}
      {props.isLoading ? <Notice tone="neutral" message={props.loadingMessage} /> : null}
      {!props.error && !props.isLoading && !props.hasItems ? (
        <Notice tone="neutral" message={props.emptyMessage} />
      ) : null}
      {!props.error && !props.isLoading && props.hasItems && !props.hasVisibleItems ? (
        <Notice tone="neutral" message={props.noMatchMessage} />
      ) : null}
    </>
  );
}
