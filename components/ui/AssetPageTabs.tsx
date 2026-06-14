export function AssetPageTabs(props: any) {
  return (
    <div className="space-y-6">
      {props.overview}
      {props.lineup}
      {props.stats}
      {props.technical}
      {props.playerOverview}
    </div>
  );
}
