import { issueRun } from "@/server/store/issue";
import { getRunStore } from "@/server/store/global";

export async function POST(request: Request): Promise<Response> {
  return issueRun(getRunStore(), Date.now(), request.headers.get("x-forwarded-for"));
}
