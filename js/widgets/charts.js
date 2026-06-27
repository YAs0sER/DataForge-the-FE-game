/**
 * DataForge - charts.js
 *
 * Lightweight SVG chart primitives for the learning levels.
 * Supported chart types:
 *   - bar
 *   - histogram
 *   - dotplot
 *
 * Dot plots accept either raw numbers or richer point objects:
 *   { value, label, color, state, tooltip, radius, meta, className, ariaLabel }
 *
 * Shared overlays:
 *   markers:    [{ value, label, tone }]
 *   connectors: [{ from, to, label, tone }]
 *   band:       { from, to, label, tone, opacity }
 */

'use strict';

function emit(target, type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function numeric(values) {
  return values.filter(value => typeof value === 'number' && Number.isFinite(value));
}

function formatValue(value, formatter) {
  return typeof formatter === 'function' ? formatter(value) : String(value);
}

function histogram(values, binCount = 6) {
  const nums = numeric(values);
  if (!nums.length) return [];

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const size = span / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + index * size,
    end: index === binCount - 1 ? max : min + (index + 1) * size,
    count: 0,
  }));

  nums.forEach(value => {
    const rawIndex = Math.floor((value - min) / size);
    const index = clamp(rawIndex, 0, bins.length - 1);
    bins[index].count++;
  });

  return bins;
}

function normalizeDotplotData(values) {
  return values
    .map((entry, index) => {
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        return {
          sourceIndex: index,
          value: entry,
          label: String(entry),
          color: null,
          state: 'default',
          tooltip: null,
          radius: null,
          meta: null,
          className: '',
          ariaLabel: null,
        };
      }

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const value = Number(entry.value);
      if (!Number.isFinite(value)) {
        return null;
      }

      return {
        sourceIndex: index,
        value,
        label: entry.label ?? String(value),
        color: entry.color ?? null,
        state: entry.state ?? 'default',
        tooltip: entry.tooltip ?? null,
        radius: entry.radius ?? null,
        meta: entry.meta ?? null,
        className: entry.className ?? '',
        ariaLabel: entry.ariaLabel ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.value - b.value || a.sourceIndex - b.sourceIndex);
}

function stackDotplotPoints(points) {
  const buckets = new Map();

  points.forEach(point => {
    if (!buckets.has(point.value)) {
      buckets.set(point.value, []);
    }
    buckets.get(point.value).push(point);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([value, bucketPoints]) => ({ value, points: bucketPoints }));
}

function autoLinearTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];

  const ticks = [];
  const step = (max - min) / Math.max(count - 1, 1);

  for (let index = 0; index < count; index += 1) {
    ticks.push(min + step * index);
  }

  return ticks;
}

function createValueScale(values, left, right, mode = 'linear') {
  const nums = numeric(values);
  if (!nums.length) {
    return {
      min: 0,
      max: 1,
      toX: () => left,
      defaultTicks: () => [0, 1],
    };
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);

  if (min === max) {
    return {
      min,
      max,
      toX: () => left + (right - left) / 2,
      defaultTicks: () => [min],
    };
  }

  if (mode !== 'distribution') {
    return {
      min,
      max,
      toX(value) {
        const ratio = (value - min) / (max - min);
        return left + clamp(ratio, 0, 1) * (right - left);
      },
      defaultTicks(count = 5) {
        return autoLinearTicks(min, max, count);
      },
    };
  }

  const unique = [...new Set(nums)].sort((a, b) => a - b);
  if (unique.length < 3) {
    return {
      min,
      max,
      toX(value) {
        const ratio = (value - min) / (max - min);
        return left + clamp(ratio, 0, 1) * (right - left);
      },
      defaultTicks(count = 5) {
        return autoLinearTicks(min, max, count);
      },
    };
  }

  const weights = [];
  let totalWeight = 0;
  for (let index = 1; index < unique.length; index += 1) {
    const gap = Math.max(unique[index] - unique[index - 1], 1);
    const weight = 1 + Math.log10(gap);
    weights.push(weight);
    totalWeight += weight;
  }

  const positions = new Map();
  positions.set(unique[0], left);

  let cursor = left;
  for (let index = 1; index < unique.length; index += 1) {
    cursor += (weights[index - 1] / totalWeight) * (right - left);
    positions.set(unique[index], cursor);
  }

  return {
    min,
    max,
    toX(value) {
      if (value <= unique[0]) return left;
      if (value >= unique[unique.length - 1]) return right;
      if (positions.has(value)) return positions.get(value);

      for (let index = 1; index < unique.length; index += 1) {
        const lowerValue = unique[index - 1];
        const upperValue = unique[index];
        if (value <= upperValue) {
          const lowerX = positions.get(lowerValue);
          const upperX = positions.get(upperValue);
          const fraction = (value - lowerValue) / (upperValue - lowerValue || 1);
          return lowerX + fraction * (upperX - lowerX);
        }
      }

      return right;
    },
    defaultTicks() {
      return [unique[0], unique[unique.length - 1]];
    },
  };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => Number.isFinite(value)))].sort((a, b) => a - b);
}

export class ChartWidget {
  constructor(container, config = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('ChartWidget: container must be an HTMLElement.');
    }

    this._container = container;
    this._config = {
      type: 'bar',
      data: [],
      title: '',
      worldColor: 'var(--color-primary)',
      bins: 6,
      height: 260,
      minWidth: 520,
      showGrid: false,
      scaleMode: 'linear',
      tickValues: null,
      valueFormatter: null,
      tooltipFormatter: null,
      markers: [],
      connectors: [],
      band: null,
      ariaLabel: '',
      onPointClick: null,
      ...config,
    };

    this._nodeDetails = new Map();
    this.render();
  }

  update(nextConfig = {}) {
    this._config = { ...this._config, ...nextConfig };
    this.render();
  }

  destroy() {
    this._container.innerHTML = '';
    this._nodeDetails.clear();
  }

  render() {
    this._container.innerHTML = `
      <section class="chart-widget" style="--world-color:${this._config.worldColor}">
        ${this._config.title ? `<header class="chart-widget__header"><h3 class="panel-title">${escapeHtml(this._config.title)}</h3></header>` : ''}
        <div class="chart-widget__surface">
          <div class="chart-widget__tooltip" hidden></div>
        </div>
      </section>
    `;

    this._surfaceEl = this._container.querySelector('.chart-widget__surface');
    this._tooltipEl = this._container.querySelector('.chart-widget__tooltip');
    this._nodeDetails.clear();

    switch (this._config.type) {
      case 'histogram':
        this._renderHistogram();
        break;
      case 'dotplot':
        this._renderDotPlot();
        break;
      case 'bar':
      default:
        this._renderBarChart();
        break;
    }

    this._wireNodeInteractions();
  }

  _renderBarChart() {
    const data = this._config.data;
    const width = Math.max(this._config.minWidth, data.length * 84, 640);
    const height = this._config.height;
    const max = Math.max(...data.map(item => item.value), 1);
    const barWidth = Math.max(42, Math.floor((width - 80) / Math.max(data.length, 1)));

    const bars = data.map((item, index) => {
      const x = 50 + index * barWidth;
      const barHeight = ((height - 70) * item.value) / max;
      const y = height - 40 - barHeight;
      const nodeId = `bar-${index}`;
      const detail = {
        type: 'bar',
        index,
        label: item.label,
        value: item.value,
        color: item.color ?? 'var(--world-color)',
        tooltip: this._config.tooltipFormatter?.(item, index) ?? `${item.label}: ${formatValue(item.value, this._config.valueFormatter)}`,
      };

      this._nodeDetails.set(nodeId, detail);

      return `
        <g
          class="chart-bar"
          data-node-id="${nodeId}"
          tabindex="0"
          role="button"
          aria-label="${escapeHtml(detail.tooltip)}"
        >
          <rect x="${x}" y="${y}" width="${barWidth - 12}" height="${barHeight}" rx="10" fill="${detail.color}"></rect>
          <text x="${x + (barWidth - 12) / 2}" y="${height - 16}" text-anchor="middle" class="chart-label">${escapeHtml(item.label)}</text>
          <text x="${x + (barWidth - 12) / 2}" y="${y - 8}" text-anchor="middle" class="chart-value">${escapeHtml(formatValue(item.value, this._config.valueFormatter))}</text>
        </g>
      `;
    }).join('');

    this._surfaceEl.insertAdjacentHTML('afterbegin', `
      <svg class="chart-svg" style="min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(this._config.ariaLabel || this._config.title || 'Bar chart')}">
        <line class="chart-axis" x1="40" y1="${height - 40}" x2="${width - 20}" y2="${height - 40}"></line>
        <line class="chart-axis" x1="40" y1="20" x2="40" y2="${height - 40}"></line>
        ${bars}
      </svg>
    `);
  }

  _renderHistogram() {
    const bins = histogram(this._config.data, this._config.bins);
    const width = Math.max(this._config.minWidth, bins.length * 86, 640);
    const height = this._config.height;
    const max = Math.max(...bins.map(bin => bin.count), 1);
    const barWidth = Math.max(46, Math.floor((width - 80) / Math.max(bins.length, 1)));

    const bars = bins.map((bin, index) => {
      const x = 50 + index * barWidth;
      const barHeight = ((height - 70) * bin.count) / max;
      const y = height - 40 - barHeight;
      const label = `${bin.start.toFixed(0)}-${bin.end.toFixed(0)}`;
      const nodeId = `hist-${index}`;
      const detail = {
        type: 'histogram',
        index,
        start: bin.start,
        end: bin.end,
        label,
        value: bin.count,
        tooltip: this._config.tooltipFormatter?.(bin, index) ?? `${label}: ${bin.count}`,
      };

      this._nodeDetails.set(nodeId, detail);

      return `
        <g
          class="chart-bar"
          data-node-id="${nodeId}"
          tabindex="0"
          role="button"
          aria-label="${escapeHtml(detail.tooltip)}"
        >
          <rect x="${x}" y="${y}" width="${barWidth - 8}" height="${barHeight}" rx="10" fill="var(--world-color)"></rect>
          <text x="${x + (barWidth - 8) / 2}" y="${height - 16}" text-anchor="middle" class="chart-label">${escapeHtml(label)}</text>
          <text x="${x + (barWidth - 8) / 2}" y="${y - 8}" text-anchor="middle" class="chart-value">${bin.count}</text>
        </g>
      `;
    }).join('');

    this._surfaceEl.insertAdjacentHTML('afterbegin', `
      <svg class="chart-svg" style="min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(this._config.ariaLabel || this._config.title || 'Histogram')}">
        <line class="chart-axis" x1="40" y1="${height - 40}" x2="${width - 20}" y2="${height - 40}"></line>
        <line class="chart-axis" x1="40" y1="20" x2="40" y2="${height - 40}"></line>
        ${bars}
      </svg>
    `);
  }

  _renderDotPlot() {
    const points = normalizeDotplotData(this._config.data);
    const stacks = stackDotplotPoints(points);
    const width = Math.max(this._config.minWidth, 760);
    const height = this._config.height;
    const plotTop = 32;
    const baseY = height - 50;
    const maxStack = Math.max(...stacks.map(stack => stack.points.length), 1);
    const stackGap = maxStack > 1
      ? Math.max(16, Math.min(22, Math.floor((baseY - plotTop - 12) / (maxStack - 1))))
      : 20;
    const scale = createValueScale(points.map(point => point.value), 52, width - 24, this._config.scaleMode);
    const tickValues = uniqueSorted(
      (Array.isArray(this._config.tickValues) && this._config.tickValues.length)
        ? this._config.tickValues
        : scale.defaultTicks(5)
    );

    const grid = this._renderGridLines(scale, tickValues, plotTop, baseY);
    const band = this._renderBand(scale, plotTop, baseY);
    const markers = this._renderMarkers(scale, plotTop, baseY);
    const connectors = this._renderConnectors(scale, plotTop, baseY);

    const dots = stacks.map(stack => {
      const x = scale.toX(stack.value);

      return stack.points.map((point, dotIndex) => {
        const nodeId = `dot-${point.sourceIndex}`;
        const detail = {
          type: 'dotplot',
          index: point.sourceIndex,
          label: point.label,
          value: point.value,
          meta: point.meta,
          state: point.state,
          tooltip: this._config.tooltipFormatter?.(point, point.sourceIndex)
            ?? point.tooltip
            ?? `Value: ${formatValue(point.value, this._config.valueFormatter)}`,
        };

        this._nodeDetails.set(nodeId, detail);

        const classNames = [
          'chart-dot',
          point.state && point.state !== 'default' ? `chart-dot--${point.state}` : '',
          point.className ?? '',
        ].filter(Boolean).join(' ');

        const radius = point.radius ?? 7;
        const ariaLabel = point.ariaLabel ?? detail.tooltip;

        return `
          <circle
            class="${classNames}"
            data-node-id="${nodeId}"
            cx="${x}"
            cy="${baseY - dotIndex * stackGap}"
            r="${radius}"
            fill="${point.color ?? 'var(--world-color)'}"
            tabindex="0"
            role="button"
            aria-label="${escapeHtml(ariaLabel)}"
          ></circle>
        `;
      }).join('');
    }).join('');

    const labels = tickValues.map(value => `
      <text x="${scale.toX(value)}" y="${height - 14}" text-anchor="middle" class="chart-label chart-axis-label">
        ${escapeHtml(formatValue(value, this._config.valueFormatter))}
      </text>
    `).join('');

    this._surfaceEl.insertAdjacentHTML('afterbegin', `
      <svg class="chart-svg" style="min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(this._config.ariaLabel || this._config.title || 'Dot plot')}">
        ${grid}
        ${band}
        ${connectors}
        ${markers}
        <line class="chart-axis" x1="40" y1="${baseY}" x2="${width - 20}" y2="${baseY}"></line>
        ${dots}
        ${labels}
      </svg>
    `);
  }

  _renderGridLines(scale, tickValues, top, bottom) {
    if (!this._config.showGrid || !tickValues.length) return '';

    return tickValues.map(value => `
      <line class="chart-grid" x1="${scale.toX(value)}" y1="${top}" x2="${scale.toX(value)}" y2="${bottom}"></line>
    `).join('');
  }

  _renderBand(scale, top, bottom) {
    const band = this._config.band;
    if (!band || !Number.isFinite(band.from) || !Number.isFinite(band.to)) {
      return '';
    }

    const start = Math.min(scale.toX(band.from), scale.toX(band.to));
    const end = Math.max(scale.toX(band.from), scale.toX(band.to));
    const width = Math.max(end - start, 6);
    const tone = band.tone ?? 'var(--world-color)';
    const opacity = typeof band.opacity === 'number' ? band.opacity : 0.12;

    return `
      <g class="chart-band" style="--chart-tone:${tone}; --chart-opacity:${opacity};">
        <rect x="${start}" y="${top}" width="${width}" height="${bottom - top}" rx="18"></rect>
        ${band.label ? `<text x="${start + width / 2}" y="${top + 18}" text-anchor="middle" class="chart-band__label">${escapeHtml(band.label)}</text>` : ''}
      </g>
    `;
  }

  _renderMarkers(scale, top, bottom) {
    if (!Array.isArray(this._config.markers) || !this._config.markers.length) {
      return '';
    }

    return this._config.markers
      .filter(marker => Number.isFinite(marker?.value))
      .map(marker => {
        const x = scale.toX(marker.value);
        const tone = marker.tone ?? 'var(--world-color)';

        return `
          <g class="chart-marker" style="--chart-tone:${tone};">
            <line class="chart-marker__line" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"></line>
            ${marker.label ? `<text class="chart-marker__label" x="${x}" y="${top - 8}" text-anchor="middle">${escapeHtml(marker.label)}</text>` : ''}
          </g>
        `;
      })
      .join('');
  }

  _renderConnectors(scale, top, bottom) {
    if (!Array.isArray(this._config.connectors) || !this._config.connectors.length) {
      return '';
    }

    return this._config.connectors
      .filter(connector => Number.isFinite(connector?.from) && Number.isFinite(connector?.to))
      .map((connector, index) => {
        const x1 = scale.toX(connector.from);
        const x2 = scale.toX(connector.to);
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);
        const y = top + 20 + index * 20;
        const tone = connector.tone ?? 'var(--world-color)';

        return `
          <g class="chart-connector" style="--chart-tone:${tone};">
            <line class="chart-connector__stem" x1="${start}" y1="${y}" x2="${start}" y2="${bottom - 4}"></line>
            <line class="chart-connector__stem" x1="${end}" y1="${y}" x2="${end}" y2="${bottom - 4}"></line>
            <line class="chart-connector__line" x1="${start}" y1="${y}" x2="${end}" y2="${y}"></line>
            ${connector.label ? `<text class="chart-connector__label" x="${start + (end - start) / 2}" y="${y - 8}" text-anchor="middle">${escapeHtml(connector.label)}</text>` : ''}
          </g>
        `;
      })
      .join('');
  }

  _wireNodeInteractions() {
    const nodes = this._surfaceEl.querySelectorAll('[data-node-id]');

    nodes.forEach(node => {
      const nodeId = node.getAttribute('data-node-id');
      const detail = this._nodeDetails.get(nodeId);
      if (!detail) return;

      node.addEventListener('click', () => {
        this._activateNode(detail);
      });

      node.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this._activateNode(detail);
      });

      if (!detail.tooltip) return;

      node.addEventListener('pointerenter', event => {
        this._showTooltip(detail.tooltip, event.clientX, event.clientY);
      });

      node.addEventListener('pointermove', event => {
        this._showTooltip(detail.tooltip, event.clientX, event.clientY);
      });

      node.addEventListener('pointerleave', () => {
        this._hideTooltip();
      });

      node.addEventListener('focus', () => {
        this._showTooltipFromNode(detail.tooltip, node);
      });

      node.addEventListener('blur', () => {
        this._hideTooltip();
      });
    });
  }

  _activateNode(detail) {
    this._config.onPointClick?.(detail);
    emit(this._container, 'chart:point-click', detail);
  }

  _showTooltip(text, clientX, clientY) {
    if (!this._tooltipEl || !text) return;

    const bounds = this._surfaceEl.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;

    this._tooltipEl.hidden = false;
    this._tooltipEl.textContent = text;
    this._tooltipEl.style.left = `${x}px`;
    this._tooltipEl.style.top = `${y}px`;
    this._tooltipEl.dataset.visible = 'true';
  }

  _showTooltipFromNode(text, node) {
    if (!text) return;

    const nodeBounds = node.getBoundingClientRect();
    const bounds = this._surfaceEl.getBoundingClientRect();
    const x = nodeBounds.left - bounds.left + nodeBounds.width / 2;
    const y = nodeBounds.top - bounds.top;

    this._tooltipEl.hidden = false;
    this._tooltipEl.textContent = text;
    this._tooltipEl.style.left = `${x}px`;
    this._tooltipEl.style.top = `${y}px`;
    this._tooltipEl.dataset.visible = 'true';
  }

  _hideTooltip() {
    if (!this._tooltipEl) return;
    this._tooltipEl.hidden = true;
    this._tooltipEl.dataset.visible = 'false';
  }
}
