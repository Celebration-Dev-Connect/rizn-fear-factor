import { OffseasonPage } from "./OffseasonPage";

// Exported as 404.html. CloudFront serves index.html for unknown paths, but this keeps any direct
// 404 on-brand too.
export default function NotFound() {
  return <OffseasonPage />;
}
