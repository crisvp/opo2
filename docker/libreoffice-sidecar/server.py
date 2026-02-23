"""
LibreOffice sidecar — converts Office documents to PDF.
Exposes POST /convert accepting multipart/form-data with a 'file' field.
Returns the converted PDF as application/pdf.
"""
import os
import subprocess
import tempfile
from flask import Flask, request, send_file, jsonify

app = Flask(__name__)
MAX_SIZE = 100 * 1024 * 1024  # 100 MB


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/convert", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify({"error": "No file field in request"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, file.filename)
        file.save(input_path)

        result = subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--norestore",
                "--nofirststartwizard",
                "--convert-to",
                "pdf",
                "--outdir",
                tmpdir,
                input_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            return jsonify({"error": "Conversion failed", "detail": result.stderr}), 500

        # LibreOffice outputs <basename>.pdf
        basename = os.path.splitext(file.filename)[0]
        output_path = os.path.join(tmpdir, f"{basename}.pdf")

        if not os.path.exists(output_path):
            return jsonify({"error": "Output PDF not found after conversion"}), 500

        return send_file(output_path, mimetype="application/pdf", as_attachment=False)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=False)
