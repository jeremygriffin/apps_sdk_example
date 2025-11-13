interface LoadingStateProps {
  message?: string;
}

export const LoadingState = ({ message = "Loading todos..." }: LoadingStateProps) => (
  <div className="loading-state" role="status">
    <p>{message}</p>
  </div>
);
