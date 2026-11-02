import zlib
import struct
import os

SOURCE_PATH = "/home/eldor_firdavsov/.gemini/antigravity-ide/brain/ba8a4419-f27d-4d1f-a360-c6dc235b7da8/.user_uploaded/media_1793632845634.png"
ROOT_DIR = "/home/eldor_firdavsov/Desktop/UzHamyon"

def paeth_predictor(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc: return a
    elif pb <= pc: return b
    else: return c

def decode_png(filepath):
    with open(filepath, "rb") as f:
        data = f.read()

    w, h, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    if color_type != 6 or bit_depth != 8:
        raise ValueError(f"Expected RGBA 8-bit PNG, got color_type={color_type}, bit_depth={bit_depth}")

    idat = b""
    pos = 8
    while pos < len(data):
        length, tag = struct.unpack(">I4s", data[pos:pos+8])
        if tag == b"IDAT":
            idat += data[pos+8:pos+8+length]
        pos += 8 + length + 4

    raw = zlib.decompress(idat)
    bpp = 4
    stride = 1 + w * bpp
    unfiltered = bytearray(h * w * bpp)

    for y in range(h):
        filter_type = raw[y * stride]
        scanline = raw[y * stride + 1 : (y + 1) * stride]
        curr_row = bytearray(w * bpp)
        prev_row = unfiltered[(y - 1) * w * bpp : y * w * bpp] if y > 0 else bytearray(w * bpp)
        
        for x in range(w * bpp):
            recon_left = curr_row[x - bpp] if x >= bpp else 0
            recon_up = prev_row[x]
            recon_diag = prev_row[x - bpp] if x >= bpp else 0
            
            val = scanline[x]
            if filter_type == 0: recon = val
            elif filter_type == 1: recon = (val + recon_left) & 0xff
            elif filter_type == 2: recon = (val + recon_up) & 0xff
            elif filter_type == 3: recon = (val + ((recon_left + recon_up) // 2)) & 0xff
            elif filter_type == 4: recon = (val + paeth_predictor(recon_left, recon_up, recon_diag)) & 0xff
            curr_row[x] = recon
        
        unfiltered[y * w * bpp : (y + 1) * w * bpp] = curr_row

    return w, h, unfiltered

def write_png(filepath, width, height, rgba_data):
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw_lines = bytearray()
    stride = width * 4
    for y in range(height):
        raw_lines.append(0) # filter type 0: None
        raw_lines.extend(rgba_data[y * stride : (y + 1) * stride])
    
    idat_data = zlib.compress(bytes(raw_lines), 9)
    
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)
    
    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat_data)
        + chunk(b"IEND", b"")
    )
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(png_bytes)

def resample_bilinear(src_rgba, src_w, src_h, dst_w, dst_h):
    dst_rgba = bytearray(dst_w * dst_h * 4)
    x_ratio = float(src_w - 1) / dst_w if dst_w > 1 else 0
    y_ratio = float(src_h - 1) / dst_h if dst_h > 1 else 0

    for y in range(dst_h):
        src_y = y * y_ratio
        y_low = int(src_y)
        y_high = min(y_low + 1, src_h - 1)
        y_weight = src_y - y_low

        for x in range(dst_w):
            src_x = x * x_ratio
            x_low = int(src_x)
            x_high = min(x_low + 1, src_w - 1)
            x_weight = src_x - x_low

            dst_idx = (y * dst_w + x) * 4

            # Sample 4 surrounding pixels
            tl = (y_low * src_w + x_low) * 4
            tr = (y_low * src_w + x_high) * 4
            bl = (y_high * src_w + x_low) * 4
            br = (y_high * src_w + x_high) * 4

            for c in range(4):
                top = src_rgba[tl + c] * (1.0 - x_weight) + src_rgba[tr + c] * x_weight
                bot = src_rgba[bl + c] * (1.0 - x_weight) + src_rgba[br + c] * x_weight
                val = int(top * (1.0 - y_weight) + bot * y_weight)
                dst_rgba[dst_idx + c] = max(0, min(255, val))

    return dst_rgba

def create_ico(png_data, width, height):
    header = Buffer = struct.pack("<HHH", 0, 1, 1) # reserved 0, type 1 (ico), 1 image
    b_width = 0 if width >= 256 else width
    b_height = 0 if height >= 256 else height
    dir_entry = struct.pack("<BBBBHHII", b_width, b_height, 0, 0, 1, 32, len(png_data), 22)
    return header + dir_entry + png_data

def main():
    print(f"Decoding {SOURCE_PATH}...")
    w, h, raw_rgba = decode_png(SOURCE_PATH)
    print(f"Original: {w}x{h}")

    # Remove white background and un-mat edges
    processed = bytearray(len(raw_rgba))
    min_x, max_x = w, 0
    min_y, max_y = h, 0

    for y in range(h):
        for x in range(w):
            idx = (y * w + x) * 4
            r = raw_rgba[idx]
            g = raw_rgba[idx + 1]
            b = raw_rgba[idx + 2]

            dist_from_white = ((255 - r)**2 + (255 - g)**2 + (255 - b)**2) ** 0.5

            if dist_from_white <= 6:
                alpha = 0
                nr, ng, nb = 0, 0, 0
            elif dist_from_white >= 42:
                alpha = 255
                nr, ng, nb = r, g, b
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
            else:
                t = (dist_from_white - 6) / (42 - 6)
                alpha = int(t * 255)
                a_norm = alpha / 255.0
                if a_norm > 0.01:
                    def unmat(val):
                        unmatted = int((val - 255 * (1.0 - a_norm)) / a_norm)
                        return max(0, min(255, unmatted))
                    nr = unmat(r)
                    ng = unmat(g)
                    nb = unmat(b)
                else:
                    nr, ng, nb = 0, 0, 0
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y

            processed[idx] = nr
            processed[idx + 1] = ng
            processed[idx + 2] = nb
            processed[idx + 3] = alpha

    print(f"Bounding box: x=[{min_x}, {max_x}], y=[{min_y}, {max_y}]")
    bbox_w = max_x - min_x + 1
    bbox_h = max_y - min_y + 1
    print(f"Emblem dimensions: {bbox_w} x {bbox_h}")

    # Crop with balanced padding into a square
    max_dim = max(bbox_w, bbox_h)
    pad = int(max_dim * 0.04) # 4% optical padding
    square_size = max_dim + 2 * pad

    square_rgba = bytearray(square_size * square_size * 4)

    # Offset to center the emblem inside square_rgba
    offset_x = (square_size - bbox_w) // 2
    offset_y = (square_size - bbox_h) // 2

    for by in range(bbox_h):
        for bx in range(bbox_w):
            src_idx = ((min_y + by) * w + (min_x + bx)) * 4
            dst_idx = ((offset_y + by) * square_size + (offset_x + bx)) * 4
            square_rgba[dst_idx : dst_idx + 4] = processed[src_idx : src_idx + 4]

    print(f"Created square transparent canvas: {square_size} x {square_size}")

    # Scale to standard sizes
    # 1. High-res 512x512
    rgba_512 = resample_bilinear(square_rgba, square_size, square_size, 512, 512)
    # 2. 192x192 for web app icon
    rgba_192 = resample_bilinear(square_rgba, square_size, square_size, 192, 192)
    # 3. 180x180 for apple-icon
    rgba_180 = resample_bilinear(square_rgba, square_size, square_size, 180, 180)

    # Write destination files
    files_to_write_512 = [
        f"{ROOT_DIR}/public/uzhamyon-icon-transparent.png",
        f"{ROOT_DIR}/public/uzhamyon-icon.png",
        f"{ROOT_DIR}/public/uzhamyon-logo-transparent.png",
        f"{ROOT_DIR}/public/uzhamyon-logo.png",
    ]
    for path in files_to_write_512:
        write_png(path, 512, 512, rgba_512)
        print(f"✓ Wrote 512x512 transparent logo: {path}")

    write_png(f"{ROOT_DIR}/public/icon.png", 192, 192, rgba_192)
    write_png(f"{ROOT_DIR}/src/app/icon.png", 192, 192, rgba_192)
    print("✓ Wrote 192x192 transparent icon.png to public/ and src/app/")

    apple_png_path = f"{ROOT_DIR}/public/apple-icon.png"
    write_png(apple_png_path, 180, 180, rgba_180)
    write_png(f"{ROOT_DIR}/src/app/apple-icon.png", 180, 180, rgba_180)
    print("✓ Wrote 180x180 transparent apple-icon.png to public/ and src/app/")

    # Create matching favicon.ico from 180x180 transparent PNG
    with open(apple_png_path, "rb") as f:
        apple_png_bytes = f.read()

    ico_bytes = create_ico(apple_png_bytes, 180, 180)
    with open(f"{ROOT_DIR}/public/favicon.ico", "wb") as f:
        f.write(ico_bytes)
    with open(f"{ROOT_DIR}/src/app/favicon.ico", "wb") as f:
        f.write(ico_bytes)
    print("✓ Wrote transparent favicon.ico to public/ and src/app/")

if __name__ == "__main__":
    main()
