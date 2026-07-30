import type { JoinRequest } from "@shared/types/game";

export interface JoinRequestsBarProps {
  joinRequests: JoinRequest[];
  onApproveJoin: (requestId: number) => void;
  onRejectJoin: (requestId: number) => void;
}

export default function JoinRequestsBar({
  joinRequests,
  onApproveJoin,
  onRejectJoin,
}: JoinRequestsBarProps) {
  if (joinRequests.length === 0) return null;

  return (
    <div className="join-requests">
      <p className="join-requests-title">Pedidos de entrada ({joinRequests.length})</p>
      <ul>
        {joinRequests.map((req) => (
          <li key={req.id}>
            <span>{req.name}</span>
            <span className="join-requests-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => onApproveJoin(req.id)}
              >
                Aprovar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => onRejectJoin(req.id)}
              >
                Recusar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
