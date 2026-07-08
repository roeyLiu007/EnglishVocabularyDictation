export async function readApiJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${fallbackMessage}：服务器没有返回内容，请稍后重试`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${fallbackMessage}：服务器返回了无法识别的内容（HTTP ${response.status}）`);
  }
}
