import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from backend.app.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    APP_FRONTEND_URL,
    ENVIRONMENT
)

logger = logging.getLogger("artisan_ai.email_service")


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """
    Sends an email using standard SMTP.
    If SMTP credentials are not configured, logs a clean mock output in dev/test.
    Never crashes the application.
    """
    if not to_email or "@" not in to_email:
        logger.warning("[Email] Invalid recipient email: %s", to_email)
        return False

    # Prevent sending to mock/test/dummy addresses that cause Mailer-Daemon bounce
    local_part = to_email.split("@")[0].strip().lower()
    domain = to_email.split("@")[-1].strip().lower()
    DUMMY_DOMAINS = {
        "artisanai.in",
        "test.com",
        "example.com",
        "example.org",
        "sample.com",
        "dummy.com",
        "fake.com",
        "localhost"
    }
    DUMMY_USERS = {"user", "test", "demo", "sample", "buyer", "seller", "admin", "attacker", "dummy", "fake"}
    if (
        domain in DUMMY_DOMAINS
        or domain.endswith(".test")
        or domain.endswith(".example")
        or local_part in DUMMY_USERS
        or local_part.startswith("test.")
        or local_part.startswith("demo.")
        or local_part.startswith("sample.")
        or ENVIRONMENT in ("test", "testing")
    ):
        logger.info("[Email Mock] Skipping real SMTP network transmission for test address '%s'", to_email)
        return True

    # Check if SMTP is configured
    if not SMTP_HOST or not SMTP_USER:
        logger.info(
            "[Email Mock] SMTP not configured. Simulating email to '%s' | Subject: '%s'",
            to_email, subject
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10.0) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10.0) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())

        logger.info("[Email] Successfully delivered email to %s (Subject: %s)", to_email, subject)
        return True
    except Exception as e:
        logger.error("[Email] Failed to send email to %s: %s", to_email, e)
        return False


def send_wishlist_reminder_email(
    to_email: str,
    buyer_name: str,
    product_title: str,
    product_price: float,
    product_image_url: Optional[str],
    product_id: int,
    artisan_name: Optional[str] = None,
    stock: int = 1
) -> bool:
    """
    Sends the 3-day 'Still interested?' wishlist reminder email.
    """
    clean_name = buyer_name or "Craft Connoisseur"
    artisan_label = artisan_name or "our master artisan"
    price_fmt = f"₹{product_price:,.0f}" if product_price else "Custom"
    image_src = product_image_url or "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600"
    deep_link = f"{APP_FRONTEND_URL}/#craft-{product_id}"
    if stock == 1:

        stock_msg = "Only 1 piece left"
        badge_text = "Only 1 Left in Stock"
    elif stock <= 5:
        stock_msg = f"Only {stock} pieces available"
        badge_text = f"Only {stock} Left in Stock"
    else:
        stock_msg = f"{stock} pieces available"
        badge_text = f"{stock} in Stock"

    subject = f"Still interested in {product_title}? {stock_msg} from {artisan_label}"

    text_content = (
        f"Namaste {clean_name},\n\n"
        f"A few days ago, you saved \"{product_title}\" to your Artisan AI Wishlist.\n"
        f"This authentic piece handcrafted by {artisan_label} currently has {stock_msg.lower()} ({stock} units in stock) at {price_fmt}.\n\n"
        f"Every purchase directly supports rural Indian artisans with 100% fair pricing.\n\n"
        f"View and complete your order: {deep_link}\n\n"
        f"Warm regards,\nArtisan AI Team"
    )


    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF7F2;padding:30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #E8E5DF;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#933D1E;padding:24px 30px;text-align:center;">
              <span style="color:#F7E3D3;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:block;">Artisan AI • Heritage Crafts</span>
              <h1 style="color:#ffffff;font-size:22px;margin:6px 0 0 0;font-weight:700;">Still Thinking About It?</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 30px;">
              <p style="color:#2A1E17;font-size:15px;line-height:22px;margin:0 0 18px 0;">
                Namaste <strong>{clean_name}</strong>,
              </p>
              <p style="color:#6B5B51;font-size:14px;line-height:22px;margin:0 0 20px 0;">
                A few days ago, you saved this authentic creation to your wishlist. Master artisan <strong>{artisan_label}</strong> currently has <strong>{stock_msg.lower()} ({stock} in stock)</strong> available for direct shipment.
              </p>

              <!-- Product Card -->
              <table role="presentation" width="100%" style="background-color:#FAF7F2;border:1px solid #E8E5DF;border-radius:12px;overflow:hidden;margin-bottom:24px;" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="130" style="padding:12px;" valign="top">
                    <img src="{image_src}" alt="{product_title}" width="120" height="120" style="width:120px;height:120px;object-fit:cover;border-radius:8px;display:block;">
                  </td>
                  <td style="padding:16px 16px 16px 6px;" valign="middle">
                    <span style="color:#933D1E;font-size:11px;font-weight:700;text-transform:uppercase;display:block;">{artisan_label}</span>
                    <h3 style="color:#2A1E17;font-size:16px;font-weight:700;margin:4px 0 8px 0;">{product_title}</h3>
                    <div style="color:#2A1E17;font-size:18px;font-weight:800;margin-bottom:4px;">{price_fmt}</div>
                    <span style="display:inline-block;background-color:#EBFBF1;color:#1B8047;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;border:1px solid #C4EED3;">{badge_text} • Ready to Ship</span>
                  </td>
                </tr>
              </table>


              <!-- Call to Action -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{deep_link}" style="background-color:#933D1E;color:#ffffff;display:inline-block;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;box-shadow:0 2px 6px rgba(147,61,30,0.3);">
                      Complete Your Order Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Trust Points -->
              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #E8E5DF;">
                <p style="color:#6B5B51;font-size:12px;line-height:18px;margin:0;text-align:center;">
                  🌿 100% Genuine Handcrafted • 🇮🇳 Direct Fair Artisan Payout • 📦 Safe Tracked Delivery
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F4EBE1;padding:16px 30px;text-align:center;">
              <p style="color:#8D7B6F;font-size:11px;line-height:16px;margin:0;">
                You received this email because you saved this item on <a href="{APP_FRONTEND_URL}" style="color:#933D1E;text-decoration:none;font-weight:600;">Artisan AI</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return send_email(to_email=to_email, subject=subject, html_content=html_content, text_content=text_content)
