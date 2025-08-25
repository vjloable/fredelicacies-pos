# ESC/POS Logo Printing for FoodMood POS

This guide explains how to use the enhanced ESC/POS printing functionality with logo support for your FoodMood POS system.

## Overview

The system now supports printing high-quality logos at the top of receipts using ESC/POS graphic printing commands. The implementation uses the `GS v 0` command as documented in the [ESC/POS specification](https://escpos.readthedocs.io/en/latest/imaging.html#print-graphic-bank-logo-simplified-1c-79-rel).

## Features

- **Logo Header Printing**: Print your FoodMood logo at the top of each receipt
- **Image Processing**: Automatic conversion of images to ESC/POS bitmap format
- **Dithering Support**: Floyd-Steinberg dithering for improved image quality on thermal printers
- **Flexible Image Support**: Works with PNG, JPG, SVG, and other web image formats
- **Automatic Sizing**: Images are automatically resized to fit standard 48mm thermal paper (384px width)

## Usage

### Basic Usage (Recommended)

The simplest way to print receipts with your logo:

```typescript
import { formatReceiptWithLogo } from '@/lib/esc_formatter';

// Your order data
const orderData = {
  orderId: 'ORD-001',
  date: new Date(),
  items: [...],
  total: 25.50,
  // ... other order fields
};

// Generate receipt with FoodMood logo
const receiptBytes = await formatReceiptWithLogo(orderData);

// Send to printer
await printReceipt(receiptBytes);
```

### Custom Logo Usage

To use a different logo:

```typescript
import { formatReceiptWithCustomLogo } from '@/lib/esc_formatter';

const receiptBytes = await formatReceiptWithCustomLogo(
  orderData, 
  '/path/to/your/custom-logo.png'
);
```

### Manual Logo Processing

For advanced control over logo processing:

```typescript
import { LogoProcessor } from '@/lib/logo_processor';

const processor = new LogoProcessor();

// Process with dithering (recommended for photos/complex images)
const logoBitmap = await processor.processImageWithDithering('/logo.png', 384);

// Process with simple thresholding (good for simple logos)
const logoBitmap = await processor.processImage('/logo.png', 384, 128);
```

## Image Requirements

### Recommended Specifications
- **Width**: Up to 384 pixels (for 48mm thermal paper)
- **Format**: PNG with transparent background works best
- **Colors**: High contrast images work better on thermal printers
- **Style**: Simple, bold designs print clearer than complex detailed images

### Logo Optimization Tips

1. **Use High Contrast**: Black and white or high contrast images work best
2. **Avoid Fine Details**: Thermal printers have limited resolution
3. **Test Different Formats**: Try your logo as PNG, then optimize based on results
4. **Size Appropriately**: Logos should be readable but not take up too much receipt space

## Current Implementation

The logo printing is currently implemented in:

- `lib/esc_formatter.ts` - Main receipt formatting with logo support
- `lib/logo_processor.ts` - Advanced image processing utilities
- `app/(main)/store/page.tsx` - Integration with the store ordering system

## ESC/POS Commands Used

The implementation uses these ESC/POS commands:
- `ESC @` (0x1B 0x40) - Initialize printer
- `ESC a` (0x1B 0x61) - Set text alignment
- `GS v 0` (0x1D 0x76 0x30 0x00) - Print bitmap graphic

## Troubleshooting

### Logo Not Printing
1. Check that `/escpos_image.png` exists in your `public` folder
2. Verify image is accessible (no CORS issues)
3. Check printer compatibility with graphic commands
4. Try with a simpler, high-contrast image

### Poor Image Quality
1. Enable dithering: `formatReceiptWithLogo()` uses dithering by default
2. Increase image contrast before processing
3. Use PNG format with transparent background
4. Try different threshold values in manual processing

### Large File Sizes
1. Reduce image dimensions (width should be ≤ 384px)
2. Use simple, high-contrast images
3. Consider using vector formats that can be rasterized cleanly

## Testing

Use the test script to verify logo printing:

```bash
# Run the test script
npm run test:logo-printing
```

Or manually test in your development environment:

```typescript
import { testLogoPrinting } from '@/scripts/test_logo_printing';
await testLogoPrinting();
```

## Configuration

The default logo path is `/escpos_image.png`. To change this:

1. Update the path in `formatReceiptWithLogo()` function
2. Or use `formatReceiptWithCustomLogo()` with your preferred path

## Performance Notes

- Image processing happens asynchronously and doesn't block the UI
- Processed bitmaps are generated fresh for each receipt (no caching currently)
- Consider caching processed bitmaps for high-volume scenarios

## Future Enhancements

Potential improvements for future versions:
- Bitmap caching for better performance
- Multiple logo size templates
- Logo positioning options (left, center, right)
- Support for multiple logos per receipt
- QR code generation for order tracking
