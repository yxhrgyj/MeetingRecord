"""生成 PWA 图标文件"""
from PIL import Image, ImageDraw

def create_icon(size: int, filename: str):
    """创建一个简单的日历图标"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 背景圆角矩形
    padding = size // 10
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=size // 5,
        fill=(79, 70, 229, 255)  # #4f46e5
    )

    # 白色横条（模拟日历顶部）
    bar_y = size * 3 // 10
    bar_h = size // 10
    draw.rounded_rectangle(
        [size // 4, bar_y, size * 3 // 4, bar_y + bar_h],
        radius=bar_h // 2,
        fill=(255, 255, 255, 220)
    )

    # 文字行模拟
    line_y = size // 2
    for i in range(4):
        w = size * 0.3 - i * size * 0.04
        draw.rounded_rectangle(
            [size // 4, line_y + i * size // 12,
             size // 4 + int(w), line_y + i * size // 12 + size // 25],
            radius=size // 50,
            fill=(255, 255, 255, 150 - i * 30)
        )

    # 右侧圆点
    dot_x = size * 7 // 10
    dot_y = size * 7 // 10
    for i in range(3):
        r = size // 20
        draw.ellipse(
            [dot_x + i * size // 8 - r, dot_y - r,
             dot_x + i * size // 8 + r, dot_y + r],
            fill=(255, 255, 255, 150 - i * 40)
        )

    img.save(filename)
    print(f"已生成 {filename} ({size}x{size})")

if __name__ == '__main__':
    create_icon(192, 'public/pwa-192x192.png')
    create_icon(512, 'public/pwa-512x512.png')
    print("图标生成完成！")
