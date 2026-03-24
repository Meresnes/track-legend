type RouteContext = {
  params: Promise<{ status: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { status } = await params;
  const parsed = Number(status);
  const safeStatus = [401, 404, 500].includes(parsed) ? parsed : 500;

  return Response.json(
    {
      message: `Simulated API error ${safeStatus}`,
      code: `SIM_${safeStatus}`,
    },
    { status: safeStatus },
  );
}
