export interface TileBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export interface ObjectData {
  bounds: TileBounds;
  pixels: PixelCoord[];
}

export interface DetectedTile {
  index: number;
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
}

export interface TileDetectionConfig {
  tileSizeX: number;
  tileSizeY: number;
  contentThreshold: number;
  objectSeparationSensitivity: number;
}

export class TileDetector {
  private config: TileDetectionConfig;

  constructor(config: TileDetectionConfig) {
    this.config = config;
  }

  isPixelTransparent(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
    const index = (y * width + x) * 4 + 3;
    return data[index] <= this.config.contentThreshold;
  }

  isPixelTransparentFast(data: Uint8ClampedArray, pixelIndex: number): boolean {
    return data[pixelIndex * 4 + 3] <= this.config.contentThreshold;
  }

  findVerticalGaps(data: Uint8ClampedArray, width: number, height: number): number[] {
    const gaps: number[] = [];
    for (let x = 1; x < width - 1; x++) {
      let hasContent = false;
      for (let y = 0; y < height; y++) {
        if (!this.isPixelTransparent(data, x, y, width)) {
          hasContent = true;
          break;
        }
      }
      if (!hasContent) {
        let leftHasContent = false;
        let rightHasContent = false;
        for (let y = 0; y < height; y++) {
          if (!this.isPixelTransparent(data, x - 1, y, width)) {
            leftHasContent = true;
            break;
          }
        }
        for (let y = 0; y < height; y++) {
          if (!this.isPixelTransparent(data, x + 1, y, width)) {
            rightHasContent = true;
            break;
          }
        }
        if (leftHasContent && rightHasContent) {
          gaps.push(x);
        }
      }
    }
    return gaps;
  }

  findObjectBoundsInRegion(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    regionX: number,
    regionY: number,
    regionWidth: number,
    regionHeight: number
  ): TileBounds | null {
    let minX = regionX + regionWidth;
    let maxX = regionX;
    let minY = regionY + regionHeight;
    let maxY = regionY;
    let hasContent = false;

    for (let y = regionY; y < regionY + regionHeight && y < imageHeight; y++) {
      for (let x = regionX; x < regionX + regionWidth && x < imageWidth; x++) {
        if (!this.isPixelTransparent(data, x, y, imageWidth)) {
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasContent) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  floodFillObjectDataInRegion(
    data: Uint8ClampedArray,
    regionWidth: number,
    regionHeight: number,
    startX: number,
    startY: number,
    visited: boolean[]
  ): ObjectData | null {
    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixelCount = 0;
    const objectPixels: PixelCoord[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const {x, y} = current;
      if (x < 0 || x >= regionWidth || y < 0 || y >= regionHeight) continue;
      const pixelIndex = y * regionWidth + x;
      if (visited[pixelIndex] || this.isPixelTransparent(data, x, y, regionWidth)) continue;
      visited[pixelIndex] = true;
      pixelCount++;
      objectPixels.push({x, y});
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      stack.push({x: x + 1, y: y});
      stack.push({x: x - 1, y: y});
      stack.push({x: x, y: y + 1});
      stack.push({x: x, y: y - 1});
    }

    if (pixelCount === 0) return null;

    const padding = 1;
    const finalX = Math.max(0, minX - padding);
    const finalY = Math.max(0, minY - padding);
    const finalMaxX = Math.min(regionWidth - 1, maxX + padding);
    const finalMaxY = Math.min(regionHeight - 1, maxY + padding);

    return {
      bounds: { x: finalX, y: finalY, width: finalMaxX - finalX + 1, height: finalMaxY - finalY + 1 },
      pixels: objectPixels
    };
  }

  floodFillBoundsOnly(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    startX: number,
    startY: number,
    visited: Uint8Array,
    use4Connectivity: boolean = false
  ): TileBounds | null {
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixelCount = 0;
    const stack: number[] = [];
    stack.push(startY * imageWidth + startX);

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited[idx]) continue;
      const x = idx % imageWidth;
      const y = Math.floor(idx / imageWidth);
      if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) continue;
      if (this.isPixelTransparentFast(data, idx)) continue;
      visited[idx] = 1;
      pixelCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x + 1 < imageWidth) stack.push(idx + 1);
      if (x - 1 >= 0) stack.push(idx - 1);
      if (y + 1 < imageHeight) stack.push(idx + imageWidth);
      if (y - 1 >= 0) stack.push(idx - imageWidth);
      if (!use4Connectivity) {
        if (x + 1 < imageWidth && y + 1 < imageHeight) stack.push(idx + imageWidth + 1);
        if (x + 1 < imageWidth && y - 1 >= 0) stack.push(idx - imageWidth + 1);
        if (x - 1 >= 0 && y + 1 < imageHeight) stack.push(idx + imageWidth - 1);
        if (x - 1 >= 0 && y - 1 >= 0) stack.push(idx - imageWidth - 1);
      }
    }

    if (pixelCount === 0) return null;

    const padding = 1;
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(imageWidth, maxX + padding + 1) - Math.max(0, minX - padding),
      height: Math.min(imageHeight, maxY + padding + 1) - Math.max(0, minY - padding)
    };
  }

  floodFillObjectData(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    startX: number,
    startY: number,
    visited: boolean[],
    use4Connectivity: boolean = false
  ): ObjectData | null {
    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixelCount = 0;
    const objectPixels: PixelCoord[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const {x, y} = current;
      if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) continue;
      const pixelIndex = y * imageWidth + x;
      if (visited[pixelIndex] || this.isPixelTransparent(data, x, y, imageWidth)) continue;
      visited[pixelIndex] = true;
      pixelCount++;
      objectPixels.push({x, y});
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      stack.push({x: x + 1, y: y});
      stack.push({x: x - 1, y: y});
      stack.push({x: x, y: y + 1});
      stack.push({x: x, y: y - 1});
      if (!use4Connectivity) {
        stack.push({x: x + 1, y: y + 1});
        stack.push({x: x + 1, y: y - 1});
        stack.push({x: x - 1, y: y + 1});
        stack.push({x: x - 1, y: y - 1});
      }
    }

    if (pixelCount === 0) return null;

    const padding = 1;
    const finalX = Math.max(0, minX - padding);
    const finalY = Math.max(0, minY - padding);
    const finalMaxX = Math.min(imageWidth - 1, maxX + padding);
    const finalMaxY = Math.min(imageHeight - 1, maxY + padding);

    return {
      bounds: { x: finalX, y: finalY, width: finalMaxX - finalX + 1, height: finalMaxY - finalY + 1 },
      pixels: objectPixels
    };
  }

  isValidObjectSize(bounds: TileBounds, imageWidth: number, imageHeight: number): boolean {
    const minSize = 8;
    const maxSize = Math.max(imageWidth, imageHeight);
    return bounds.width >= minSize && bounds.height >= minSize && bounds.width <= maxSize && bounds.height <= maxSize && (bounds.width * bounds.height) >= (minSize * minSize);
  }

  detectIsometricLayout(imgWidth: number, imgHeight: number, tilesetImage: HTMLImageElement | null, contentThreshold: number): boolean {
    if (!tilesetImage) return false;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgWidth;
    tempCanvas.height = imgHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return false;
    tempCtx.drawImage(tilesetImage, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
    const data = imageData.data;

    const sampleSize = Math.min(10, Math.ceil(Math.sqrt(imgWidth * imgHeight / 10000)));
    let diamondCount = 0;
    let sampleCount = 0;

    for (let sy = 0; sy < imgHeight && sampleCount < sampleSize; sy += Math.max(1, Math.floor(imgHeight / sampleSize))) {
      for (let sx = 0; sx < imgWidth && sampleCount < sampleSize; sx += Math.max(1, Math.floor(imgWidth / sampleSize))) {
        sampleCount++;
        let minX = imgWidth, maxX = sx, minY = imgHeight, maxY = sy;
        let found = false;
        for (let y = sy; y < Math.min(sy + 50, imgHeight); y++) {
          for (let x = sx; x < Math.min(sx + 50, imgWidth); x++) {
            const alpha = data[(y * imgWidth + x) * 4 + 3];
            if (alpha > contentThreshold) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
              found = true;
            }
          }
        }
        if (found && maxX > minX && maxY > minY) {
          const w = maxX - minX + 1;
          const h = maxY - minY + 1;
          if (w >= h * 1.3) diamondCount++;
        }
      }
    }

    const isIsometric = sampleCount > 0 && diamondCount / sampleCount > 0.5;
    return isIsometric;
  }

  detectVariableSizedTiles(
    tilesetImage: HTMLImageElement | null,
    overrideSensitivity?: number,
    forceIsometric: boolean = false
  ): DetectedTile[] {
    if (!tilesetImage) return [];

    const imgWidth = tilesetImage.width;
    const imgHeight = tilesetImage.height;
    const totalPixels = imgWidth * imgHeight;
    const useFastMode = totalPixels > 500000;

    const isIsometric = forceIsometric || this.detectIsometricLayout(imgWidth, imgHeight, tilesetImage, this.config.contentThreshold);
    const sensitivity = overrideSensitivity ?? this.config.objectSeparationSensitivity;

    console.log(`Tile detection: ${imgWidth}x${imgHeight} (${totalPixels} pixels), fastMode: ${useFastMode}, isometric: ${isIsometric}, sensitivity: ${sensitivity.toFixed(2)}`);
    const startTime = performance.now();

    const detectedTiles: DetectedTile[] = [];
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgWidth;
    tempCanvas.height = imgHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return [];

    tempCtx.drawImage(tilesetImage, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
    const data = imageData.data;
    let tileIndex = 1;

    if (useFastMode) {
      const visited = new Uint8Array(imgWidth * imgHeight);
      for (let y = 0; y < imgHeight; y++) {
        for (let x = 0; x < imgWidth; x++) {
          const pixelIndex = y * imgWidth + x;
          if (visited[pixelIndex] || this.isPixelTransparentFast(data, pixelIndex)) continue;
          const bounds = this.floodFillBoundsOnly(data, imgWidth, imgHeight, x, y, visited, isIsometric);
          if (bounds && this.isValidObjectSize(bounds, imgWidth, imgHeight)) {
            const likelyMerged = bounds.width > this.config.tileSizeX * 1.8 || bounds.height > this.config.tileSizeY * 1.8;
            if (likelyMerged) {
              const localObjectData = this.buildObjectDataFromBounds(data, imgWidth, imgHeight, bounds);
              const splitObjects = this.intelligentObjectSplit(localObjectData, sensitivity, isIsometric);
              for (const splitObj of splitObjects) {
                detectedTiles.push({
                  index: tileIndex++,
                  sourceX: splitObj.x,
                  sourceY: splitObj.y,
                  width: splitObj.width,
                  height: splitObj.height
                });
              }
            } else {
              detectedTiles.push({ index: tileIndex++, sourceX: bounds.x, sourceY: bounds.y, width: bounds.width, height: bounds.height });
            }
          }
        }
      }
    } else {
      const visited = new Array(imgWidth * imgHeight).fill(false);
      const allObjects: ObjectData[] = [];
      for (let y = 0; y < imgHeight; y++) {
        for (let x = 0; x < imgWidth; x++) {
          const pixelIndex = y * imgWidth + x;
          if (visited[pixelIndex] || this.isPixelTransparent(data, x, y, imgWidth)) continue;
          const objectData = this.floodFillObjectData(data, imgWidth, imgHeight, x, y, visited, isIsometric);
          if (objectData && this.isValidObjectSize(objectData.bounds, imgWidth, imgHeight)) {
            allObjects.push(objectData);
          }
        }
      }
      for (const obj of allObjects) {
        const splitObjects = this.intelligentObjectSplit(obj, sensitivity, isIsometric);
        for (const splitObj of splitObjects) {
          detectedTiles.push({ index: tileIndex++, sourceX: splitObj.x, sourceY: splitObj.y, width: splitObj.width, height: splitObj.height });
        }
      }
    }

    const elapsed = performance.now() - startTime;
    console.log(`Tile detection completed: ${detectedTiles.length} tiles in ${elapsed.toFixed(1)}ms`);
    return detectedTiles;
  }

  buildObjectDataFromBounds(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    bounds: TileBounds
  ): ObjectData {
    const pixels: PixelCoord[] = [];
    const startX = Math.max(0, bounds.x);
    const startY = Math.max(0, bounds.y);
    const endX = Math.min(imageWidth, bounds.x + bounds.width);
    const endY = Math.min(imageHeight, bounds.y + bounds.height);
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (!this.isPixelTransparent(data, x, y, imageWidth)) {
          pixels.push({ x, y });
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (pixels.length === 0) return { bounds, pixels: [] };

    return {
      bounds: { x: minX, y: minY, width: (maxX - minX + 1), height: (maxY - minY + 1) },
      pixels
    };
  }

  splitObjectByGrid(objectData: ObjectData, direction: 'horizontal' | 'vertical'): TileBounds[] {
    const { bounds } = objectData;
    const results: TileBounds[] = [];
    if (direction === 'horizontal') {
      const stripWidth = this.config.tileSizeX;
      for (let x = bounds.x; x < bounds.x + bounds.width; x += stripWidth) {
        const stripBounds = this.findContentInRegion(objectData.pixels, { x, y: bounds.y, width: Math.min(stripWidth, bounds.x + bounds.width - x), height: bounds.height });
        if (stripBounds) results.push(stripBounds);
      }
    } else {
      const stripHeight = this.config.tileSizeY;
      for (let y = bounds.y; y < bounds.y + bounds.height; y += stripHeight) {
        const stripBounds = this.findContentInRegion(objectData.pixels, { x: bounds.x, y, width: bounds.width, height: Math.min(stripHeight, bounds.y + bounds.height - y) });
        if (stripBounds) results.push(stripBounds);
      }
    }
    return results.length > 0 ? results : [bounds];
  }

  intelligentObjectSplit(
    objectData: ObjectData,
    sensitivity: number = 0.5,
    isIsometric: boolean = false
  ): TileBounds[] {
    const { bounds, pixels } = objectData;
    const { width, height } = bounds;
    const area = pixels.length;
    const boundingArea = width * height;
    const density = area / boundingArea;
    const gridSize = Math.max(this.config.tileSizeX, this.config.tileSizeY);

    const sparseDensityThreshold = Math.max(0.18, 0.55 - (sensitivity * 0.25));
    const largeObjectDensityThreshold = Math.max(0.35, 0.9 - (sensitivity * 0.2));

    const shouldSplitHorizontally = this.shouldSplitDirection(pixels, bounds, 'horizontal', gridSize, sensitivity);
    const shouldSplitVertically = this.shouldSplitDirection(pixels, bounds, 'vertical', gridSize, sensitivity);

    const isFloorPattern = this.isFloorPattern(bounds, pixels);
    const isVerticalWall = this.isVerticalWall(bounds, pixels);
    const isHorizontalWall = this.isHorizontalWall(bounds, pixels);

    const shouldTryBridgeSplit = sensitivity >= 0.95 && (width > this.config.tileSizeX * 1.6 || height > this.config.tileSizeY * 1.6);
    if (shouldTryBridgeSplit) {
      const bridgeSplit = this.splitObjectByBridgeBreaking(objectData, sensitivity);
      if (bridgeSplit && bridgeSplit.length > 1) return bridgeSplit;
    }

    const isometricValleys = isIsometric ? this.detectIsometricValleys(pixels, bounds, sensitivity) : { rowGaps: [], colGaps: [] };

    if (isIsometric && (isometricValleys.rowGaps.length > 0 || isometricValleys.colGaps.length > 0) && !isVerticalWall && !isHorizontalWall) {
      return this.splitObjectByGaps(objectData, isometricValleys.rowGaps, isometricValleys.colGaps);
    }

    if (isFloorPattern) return this.splitObjectByGrid(objectData, 'horizontal');
    if (isVerticalWall) return [bounds];
    if (isHorizontalWall) return [bounds];

    if (shouldSplitHorizontally && width > this.config.tileSizeX * 1.5) return this.splitObjectByGrid(objectData, 'horizontal');
    if (shouldSplitVertically && height > this.config.tileSizeY * 1.5 && !this.isLikelySingleVerticalObject(bounds, pixels)) return this.splitObjectByGrid(objectData, 'vertical');

    if (density < sparseDensityThreshold && boundingArea > gridSize * gridSize * 2) return this.splitObjectByDensity(objectData);

    if ((width > this.config.tileSizeX * 1.8 || height > this.config.tileSizeY * 1.8) && !isVerticalWall && !isHorizontalWall && density < largeObjectDensityThreshold) {
      return this.splitObjectByGrid(objectData, width > height ? 'horizontal' : 'vertical');
    }

    if (!isVerticalWall && !isHorizontalWall && (width > this.config.tileSizeX * 2.6 || height > this.config.tileSizeY * 2.6)) {
      if (width > this.config.tileSizeX * 2.6 && height > this.config.tileSizeY * 2.6) return this.splitObjectByDensity(objectData);
      return this.splitObjectByGrid(objectData, width >= height ? 'horizontal' : 'vertical');
    }

    return [bounds];
  }

  isVerticalWall(bounds: TileBounds, pixels: PixelCoord[]): boolean {
    const { width, height } = bounds;
    const aspectRatio = height / width;
    const density = pixels.length / (width * height);
    if (aspectRatio < 1.5) return false;
    if (density < 0.5) return false;
    const hasConsistentWidth = this.hasConsistentVerticalWidth(pixels, bounds);
    const hasVerticalContinuity = this.hasVerticalContinuity(pixels, bounds);
    const isTallAndNarrow = height > this.config.tileSizeY * 1.5 && width <= this.config.tileSizeX * 1.2;
    return (hasConsistentWidth && hasVerticalContinuity) || (isTallAndNarrow && density > 0.6);
  }

  isHorizontalWall(bounds: TileBounds, pixels: PixelCoord[]): boolean {
    const { width, height } = bounds;
    const aspectRatio = width / height;
    const density = pixels.length / (width * height);
    if (aspectRatio < 2) return false;
    if (density < 0.6 || height < this.config.tileSizeY * 0.7) return false;
    const hasConsistentHeight = this.hasConsistentHorizontalHeight(pixels, bounds);
    const hasHorizontalContinuity = this.hasHorizontalContinuity(pixels, bounds);
    return hasConsistentHeight && hasHorizontalContinuity;
  }

  private isLikelySingleVerticalObject(bounds: TileBounds, pixels: PixelCoord[]): boolean {
    const { width, height } = bounds;
    const density = pixels.length / (width * height);
    if (density > 0.7) return true;
    return this.hasVerticalContinuity(pixels, bounds);
  }

  private hasConsistentVerticalWidth(pixels: PixelCoord[], bounds: TileBounds): boolean {
    const { y: minY, height } = bounds;
    const segmentHeight = Math.max(1, Math.floor(height / 5));
    const widths: number[] = [];
    for (let i = 0; i < 5; i++) {
      const segmentY = minY + (i * segmentHeight);
      const segmentEndY = Math.min(segmentY + segmentHeight, minY + height);
      let leftMost = Number.MAX_SAFE_INTEGER;
      let rightMost = Number.MIN_SAFE_INTEGER;
      let hasPixels = false;
      for (const pixel of pixels) {
        if (pixel.y >= segmentY && pixel.y < segmentEndY) {
          leftMost = Math.min(leftMost, pixel.x);
          rightMost = Math.max(rightMost, pixel.x);
          hasPixels = true;
        }
      }
      if (hasPixels) widths.push(rightMost - leftMost + 1);
    }
    if (widths.length < 2) return false;
    const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
    const variance = widths.reduce((sum, w) => sum + Math.pow(w - avgWidth, 2), 0) / widths.length;
    const stdDev = Math.sqrt(variance);
    return avgWidth > 0 && (stdDev / avgWidth) < 0.3;
  }

  private hasConsistentHorizontalHeight(pixels: PixelCoord[], bounds: TileBounds): boolean {
    const { x: minX, width } = bounds;
    const segmentWidth = Math.max(1, Math.floor(width / 5));
    const heights: number[] = [];
    for (let i = 0; i < 5; i++) {
      const segmentX = minX + (i * segmentWidth);
      const segmentEndX = Math.min(segmentX + segmentWidth, minX + width);
      let topMost = Number.MAX_SAFE_INTEGER;
      let bottomMost = Number.MIN_SAFE_INTEGER;
      let hasPixels = false;
      for (const pixel of pixels) {
        if (pixel.x >= segmentX && pixel.x < segmentEndX) {
          topMost = Math.min(topMost, pixel.y);
          bottomMost = Math.max(bottomMost, pixel.y);
          hasPixels = true;
        }
      }
      if (hasPixels) heights.push(bottomMost - topMost + 1);
    }
    if (heights.length < 2) return false;
    const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    const variance = heights.reduce((sum, h) => sum + Math.pow(h - avgHeight, 2), 0) / heights.length;
    const stdDev = Math.sqrt(variance);
    return avgHeight > 0 && (stdDev / avgHeight) < 0.3;
  }

  private hasVerticalContinuity(pixels: PixelCoord[], bounds: TileBounds): boolean {
    const { y: minY, height } = bounds;
    const segmentHeight = Math.max(1, Math.floor(height / 10));
    let continuousSegments = 0;
    let totalSegments = 0;
    for (let y = minY; y < minY + height; y += segmentHeight) {
      const segmentEndY = Math.min(y + segmentHeight, minY + height);
      let hasPixelsInSegment = false;
      for (const pixel of pixels) {
        if (pixel.y >= y && pixel.y < segmentEndY) { hasPixelsInSegment = true; break; }
      }
      if (hasPixelsInSegment) continuousSegments++;
      totalSegments++;
    }
    return totalSegments > 0 && (continuousSegments / totalSegments) >= 0.7;
  }

  private hasHorizontalContinuity(pixels: PixelCoord[], bounds: TileBounds): boolean {
    const { x: minX, width } = bounds;
    const segmentWidth = Math.max(1, Math.floor(width / 10));
    let continuousSegments = 0;
    let totalSegments = 0;
    for (let x = minX; x < minX + width; x += segmentWidth) {
      const segmentEndX = Math.min(x + segmentWidth, minX + width);
      let hasPixelsInSegment = false;
      for (const pixel of pixels) {
        if (pixel.x >= x && pixel.x < segmentEndX) { hasPixelsInSegment = true; break; }
      }
      if (hasPixelsInSegment) continuousSegments++;
      totalSegments++;
    }
    return totalSegments > 0 && (continuousSegments / totalSegments) >= 0.7;
  }

  private isFloorPattern(bounds: TileBounds, pixels: PixelCoord[]): boolean {
    const { width, height } = bounds;
    const isFloorHeight = height <= this.config.tileSizeY * 0.6;
    const isMultipleTileWidth = width > this.config.tileSizeX * 1.3;
    const hasRepeatingPattern = this.hasRepeatingHorizontalPattern(pixels, bounds);
    const isDiamondLike = this.hasDiamondLikeShape(pixels, bounds);
    return (isFloorHeight && isMultipleTileWidth) || (hasRepeatingPattern && isMultipleTileWidth) || (isDiamondLike && isMultipleTileWidth);
  }

  private hasRepeatingHorizontalPattern(pixels: PixelCoord[], bounds: TileBounds): boolean {
    const { x: minX, width } = bounds;
    const segmentWidth = this.config.tileSizeX;
    const segments = Math.floor(width / segmentWidth);
    if (segments < 2) return false;
    const segmentDensities: number[] = [];
    for (let i = 0; i < segments; i++) {
      const segmentStart = minX + (i * segmentWidth);
      const segmentEnd = segmentStart + segmentWidth;
      let segmentPixels = 0;
      for (const pixel of pixels) { if (pixel.x >= segmentStart && pixel.x < segmentEnd) segmentPixels++; }
      segmentDensities.push(segmentPixels);
    }
    const avgDensity = segmentDensities.reduce((a, b) => a + b, 0) / segmentDensities.length;
    const variance = segmentDensities.reduce((sum, d) => sum + Math.pow(d - avgDensity, 2), 0) / segmentDensities.length;
    const standardDeviation = Math.sqrt(variance);
    return avgDensity > 0 && (standardDeviation / avgDensity) < 0.5;
  }

  private hasDiamondLikeShape(pixels: PixelCoord[], bounds: TileBounds): boolean {
    const { y: minY, height } = bounds;
    const rowDensities: number[] = [];
    for (let y = 0; y < height; y++) {
      let rowPixels = 0;
      for (const pixel of pixels) { if (pixel.y === minY + y) rowPixels++; }
      rowDensities.push(rowPixels);
    }
    if (rowDensities.length < 3) return false;
    const edgeRows = Math.floor(rowDensities.length * 0.2);
    const middleStart = Math.floor(rowDensities.length * 0.3);
    const middleEnd = Math.floor(rowDensities.length * 0.7);
    const edgeDensity = (rowDensities.slice(0, edgeRows).reduce((a, b) => a + b, 0) + rowDensities.slice(-edgeRows).reduce((a, b) => a + b, 0)) / (edgeRows * 2 || 1);
    const middleDensity = rowDensities.slice(middleStart, middleEnd).reduce((a, b) => a + b, 0) / (middleEnd - middleStart || 1);
    return middleDensity > edgeDensity * 1.2;
  }

  private detectIsometricValleys(pixels: PixelCoord[], bounds: TileBounds, sensitivity: number): { rowGaps: number[]; colGaps: number[] } {
    const { x: minX, y: minY, width, height } = bounds;
    const minGapSize = sensitivity >= 0.9 ? 1 : 2;
    const gapRowRatio = Math.max(0.08, 0.28 - (sensitivity * 0.10));
    const gapColRatio = Math.max(0.08, 0.28 - (sensitivity * 0.10));

    const rowDensities: number[] = [];
    for (let y = 0; y < height; y++) rowDensities.push(pixels.filter(p => p.y === minY + y).length);
    const rowGaps: number[] = [];
    let rowGapStart = -1;
    for (let y = 0; y < rowDensities.length; y++) {
      if (rowDensities[y] < rowDensities.length * gapRowRatio) { if (rowGapStart === -1) rowGapStart = y; }
      else { if (rowGapStart !== -1 && (y - rowGapStart) >= minGapSize) rowGaps.push(rowGapStart); rowGapStart = -1; }
    }

    const colDensities: number[] = [];
    for (let x = 0; x < width; x++) colDensities.push(pixels.filter(p => p.x === minX + x).length);
    const colGaps: number[] = [];
    let colGapStart = -1;
    for (let x = 0; x < colDensities.length; x++) {
      if (colDensities[x] < colDensities.length * gapColRatio) { if (colGapStart === -1) colGapStart = x; }
      else { if (colGapStart !== -1 && (x - colGapStart) >= minGapSize) colGaps.push(colGapStart); colGapStart = -1; }
    }

    return { rowGaps, colGaps };
  }

  private shouldSplitDirection(pixels: PixelCoord[], bounds: TileBounds, direction: 'horizontal' | 'vertical', gridSize: number, sensitivity: number): boolean {
    const { x: minX, y: minY, width, height } = bounds;
    if (direction === 'horizontal') {
      const columnDensities: number[] = [];
      const step = Math.max(1, Math.floor(width / (width / gridSize)));
      for (let x = 0; x < width; x += step) {
        let columnPixels = 0;
        for (const pixel of pixels) { if (pixel.x >= minX + x && pixel.x < minX + x + step) columnPixels++; }
        columnDensities.push(columnPixels);
      }
      const gapFactor = Math.max(0.12, 0.42 - (sensitivity * 0.15));
      const denseFactor = Math.min(0.92, 0.58 + (sensitivity * 0.12));
      const minDenseRegions = sensitivity >= 0.95 ? 1 : 2;
      let gapCount = 0; let denseRegions = 0;
      const avgDensity = columnDensities.reduce((a, b) => a + b, 0) / columnDensities.length;
      for (let i = 0; i < columnDensities.length; i++) {
        if (columnDensities[i] < avgDensity * gapFactor) gapCount++;
        else if (columnDensities[i] > avgDensity * denseFactor) denseRegions++;
      }
      return denseRegions >= minDenseRegions && gapCount >= 1;
    } else {
      const rowDensities: number[] = [];
      const step = Math.max(1, Math.floor(height / (height / gridSize)));
      const gapFactor = Math.max(0.12, 0.42 - (sensitivity * 0.15));
      const denseFactor = Math.min(0.92, 0.58 + (sensitivity * 0.12));
      const minDenseRegions = sensitivity >= 0.95 ? 1 : 2;
      for (let y = 0; y < height; y += step) {
        let rowPixels = 0;
        for (const pixel of pixels) { if (pixel.y >= minY + y && pixel.y < minY + y + step) rowPixels++; }
        rowDensities.push(rowPixels);
      }
      let gapCount = 0; let denseRegions = 0;
      const avgDensity = rowDensities.reduce((a, b) => a + b, 0) / rowDensities.length;
      for (let i = 0; i < rowDensities.length; i++) {
        if (rowDensities[i] < avgDensity * gapFactor) gapCount++;
        else if (rowDensities[i] > avgDensity * denseFactor) denseRegions++;
      }
      return denseRegions >= minDenseRegions && gapCount >= 1;
    }
  }

  private splitObjectByGaps(objectData: ObjectData, rowGapPositions: number[], colGapPositions: number[] = []): TileBounds[] {
    const { bounds } = objectData;
    const results: TileBounds[] = [];
    if (rowGapPositions.length === 0 && colGapPositions.length === 0) return [bounds];

    const yCuts = [bounds.y, ...rowGapPositions.map(g => bounds.y + g), bounds.y + bounds.height].sort((a, b) => a - b).filter((v, idx, arr) => idx === 0 || v !== arr[idx - 1]);
    const xCuts = [bounds.x, ...colGapPositions.map(g => bounds.x + g), bounds.x + bounds.width].sort((a, b) => a - b).filter((v, idx, arr) => idx === 0 || v !== arr[idx - 1]);

    for (let yi = 0; yi < yCuts.length - 1; yi++) {
      for (let xi = 0; xi < xCuts.length - 1; xi++) {
        const topY = yCuts[yi]; const bottomY = yCuts[yi + 1]; const leftX = xCuts[xi]; const rightX = xCuts[xi + 1];
        if (bottomY > topY && rightX > leftX) {
          const region = this.findContentInRegion(objectData.pixels, { x: leftX, y: topY, width: rightX - leftX, height: bottomY - topY });
          if (region) results.push(region);
        }
      }
    }
    if (results.length === 0) return [bounds];
    const unique = new Map<string, TileBounds>();
    for (const r of results) unique.set(`${r.x}:${r.y}:${r.width}:${r.height}`, r);
    return Array.from(unique.values());
  }

  private splitObjectByDensity(objectData: ObjectData): TileBounds[] {
    const { bounds } = objectData;
    const gridSize = Math.min(this.config.tileSizeX, this.config.tileSizeY);
    const results: TileBounds[] = [];
    for (let y = bounds.y; y < bounds.y + bounds.height; y += gridSize) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += gridSize) {
        const regionBounds = this.findContentInRegion(objectData.pixels, { x, y, width: Math.min(gridSize, bounds.x + bounds.width - x), height: Math.min(gridSize, bounds.y + bounds.height - y) });
        if (regionBounds) results.push(regionBounds);
      }
    }
    return results.length > 0 ? results : [bounds];
  }

  private splitObjectByBridgeBreaking(objectData: ObjectData, sensitivity: number): TileBounds[] | null {
    const { bounds, pixels } = objectData;
    const w = bounds.width;
    const h = bounds.height;
    if (w < 4 || h < 4 || pixels.length < 12) return null;

    const toIndex = (x: number, y: number) => y * w + x;
    const mask = new Uint8Array(w * h);
    for (const p of pixels) {
      const lx = p.x - bounds.x; const ly = p.y - bounds.y;
      if (lx >= 0 && lx < w && ly >= 0 && ly < h) mask[toIndex(lx, ly)] = 1;
    }

    const erosionPasses = sensitivity >= 1.25 ? 2 : 1;
    let work = mask;
    for (let pass = 0; pass < erosionPasses; pass++) {
      const next = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = toIndex(x, y);
          if (!work[idx]) continue;
          const up = work[toIndex(x, y - 1)];
          const down = work[toIndex(x, y + 1)];
          const left = work[toIndex(x - 1, y)];
          const right = work[toIndex(x + 1, y)];
          if (up && down && left && right) next[idx] = 1;
        }
      }
      work = next;
    }

    const visited = new Uint8Array(w * h);
    const components: Array<{ minX: number; minY: number; maxX: number; maxY: number; count: number }> = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const start = toIndex(x, y);
        if (!work[start] || visited[start]) continue;
        const stack: number[] = [start]; visited[start] = 1;
        let minX = x; let maxX = x; let minY = y; let maxY = y; let count = 0;
        while (stack.length > 0) {
          const idx = stack.pop()!;
          const cx = idx % w; const cy = Math.floor(idx / w); count++;
          if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
          const neighbors: [number, number][] = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
          for (const [nx, ny] of neighbors) {
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const nIdx = toIndex(nx, ny);
            if (!work[nIdx] || visited[nIdx]) continue;
            visited[nIdx] = 1; stack.push(nIdx);
          }
        }
        components.push({ minX, minY, maxX, maxY, count });
      }
    }
    if (components.length <= 1) return null;

    const minComponentPixels = 3;
    const pad = 2 + erosionPasses;
    const results: TileBounds[] = [];
    for (const c of components) {
      if (c.count < minComponentPixels) continue;
      const region = this.findContentInRegion(pixels, {
        x: Math.max(bounds.x, bounds.x + c.minX - pad),
        y: Math.max(bounds.y, bounds.y + c.minY - pad),
        width: Math.min(bounds.x + bounds.width, bounds.x + c.maxX + pad + 1) - Math.max(bounds.x, bounds.x + c.minX - pad),
        height: Math.min(bounds.y + bounds.height, bounds.y + c.maxY + pad + 1) - Math.max(bounds.y, bounds.y + c.minY - pad)
      });
      if (region) results.push(region);
    }
    if (results.length <= 1) return null;
    const unique = new Map<string, TileBounds>();
    for (const r of results) unique.set(`${r.x}:${r.y}:${r.width}:${r.height}`, r);
    return Array.from(unique.values());
  }

  private findContentInRegion(pixels: PixelCoord[], region: TileBounds): TileBounds | null {
    let minX = Number.MAX_SAFE_INTEGER, maxX = Number.MIN_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER, maxY = Number.MIN_SAFE_INTEGER;
    let hasContent = false;
    for (const pixel of pixels) {
      if (pixel.x >= region.x && pixel.x < region.x + region.width && pixel.y >= region.y && pixel.y < region.y + region.height) {
        minX = Math.min(minX, pixel.x); maxX = Math.max(maxX, pixel.x); minY = Math.min(minY, pixel.y); maxY = Math.max(maxY, pixel.y); hasContent = true;
      }
    }
    if (!hasContent) return null;
    const padding = 1;
    return { x: Math.max(0, minX - padding), y: Math.max(0, minY - padding), width: maxX - minX + 1 + (padding * 2), height: maxY - minY + 1 + (padding * 2) };
  }
}
