interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function SparkLine({ data, width = 80, height = 24, color = '#0052FF' }: Props) {
  if (data.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  const trending = data[data.length - 1] >= data[0];
  const lineColor = color === 'auto' ? (trending ? '#00D395' : '#FF3B5C') : color;

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}
