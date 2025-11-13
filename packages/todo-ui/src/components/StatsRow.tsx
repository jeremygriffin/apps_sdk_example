interface StatsRowProps {
  total: number;
  completed: number;
  onRefresh: () => void;
  refreshing: boolean;
}

export const StatsRow = ({ total, completed, onRefresh, refreshing }: StatsRowProps) => {
  return (
    <div className="stats-row" data-testid="stats-row">
      <div>
        <strong>
          {completed} of {total} done
        </strong>
      </div>
      <button className="secondary" type="button" onClick={onRefresh} disabled={refreshing}>
        Refresh
      </button>
    </div>
  );
};
