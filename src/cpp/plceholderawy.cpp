/**
 * cv_core – C++ OpenCV operations exposed to Python via pybind11.
 *
 * Every computer-vision operation lives here; the Python / Django layer
 * is only a thin HTTP wrapper and must NEVER call cv2 directly.
 */

#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <opencv2/opencv.hpp>
#include <filesystem>
#include <string>
#include <vector>
#include <stdexcept>

namespace py = pybind11;

/* ───────────────────── internal helpers ───────────────────── */
namespace {

cv::Mat load_image(const std::string& path, const std::string& mode)
{
    int flag = cv::IMREAD_COLOR;
    if (mode == "gray")
        flag = cv::IMREAD_GRAYSCALE;
    else if (mode == "unchanged")
        flag = cv::IMREAD_UNCHANGED;

    cv::Mat img = cv::imread(path, flag);
    if (img.empty())
        throw std::runtime_error("Could not read image: " + path);
    return img;
}

void ensure_parent_dir(const std::string& path)
{
    std::filesystem::path p(path);
    if (p.has_parent_path())
        std::filesystem::create_directories(p.parent_path());
}

std::string save_image(const std::string& path, const cv::Mat& img)
{
    ensure_parent_dir(path);
    if (!cv::imwrite(path, img))
        throw std::runtime_error("Failed to write image: " + path);
    return path;
}

int ensure_odd_min3(int v)
{
    if (v < 3) v = 3;
    if (v % 2 == 0) v += 1;
    return v;
}

cv::Mat abs_preview(const cv::Mat& src)
{
    cv::Mat out;
    cv::convertScaleAbs(src, out);
    return out;
}

cv::Mat magnitude_preview(const cv::Mat& gx, const cv::Mat& gy)
{
    cv::Mat mag;
    cv::magnitude(gx, gy, mag);
    cv::normalize(mag, mag, 0, 255, cv::NORM_MINMAX);
    cv::Mat out;
    mag.convertTo(out, CV_8U);
    return out;
}

void dft_shift(cv::Mat& m)
{
    m = m(cv::Rect(0, 0, m.cols & -2, m.rows & -2));
    int cx = m.cols / 2, cy = m.rows / 2;

    cv::Mat q0(m, cv::Rect(0,  0,  cx, cy));
    cv::Mat q1(m, cv::Rect(cx, 0,  cx, cy));
    cv::Mat q2(m, cv::Rect(0,  cy, cx, cy));
    cv::Mat q3(m, cv::Rect(cx, cy, cx, cy));

    cv::Mat tmp;
    q0.copyTo(tmp); q3.copyTo(q0); tmp.copyTo(q3);
    q1.copyTo(tmp); q2.copyTo(q1); tmp.copyTo(q2);
}

/* Draw a grayscale histogram onto a canvas and return it */
cv::Mat draw_gray_hist(const cv::Mat& gray_img)
{
    constexpr int BINS = 256, W = 512, H = 400;
    const int bin_w = cvRound(static_cast<double>(W) / BINS);

    int ch[] = {0};
    int bins[] = {BINS};
    float range[] = {0, 256};
    const float* ranges[] = {range};

    cv::Mat hist;
    cv::calcHist(&gray_img, 1, ch, {}, hist, 1, bins, ranges);

    cv::Mat hn;
    cv::normalize(hist, hn, 0, H, cv::NORM_MINMAX);

    cv::Mat canvas(H, W, CV_8UC3, cv::Scalar(255, 255, 255));
    for (int i = 1; i < BINS; ++i) {
        cv::line(canvas,
                 {bin_w*(i-1), H - cvRound(hn.at<float>(i-1))},
                 {bin_w*i,     H - cvRound(hn.at<float>(i))},
                 cv::Scalar(0, 0, 0), 2);
    }
    return canvas;
}

} // anonymous namespace

/* ───────────────── 1. Read image info ─────────────────────── */

py::dict read_image_info(const std::string& path)
{
    cv::Mat color = load_image(path, "color");
    cv::Mat gray  = load_image(path, "gray");

    py::dict info;
    info["input_path"]    = path;
    info["width"]         = color.cols;
    info["height"]        = color.rows;
    info["channels"]      = color.channels();
    info["gray_channels"] = gray.channels();
    return info;
}

/* ───────────────── 2. Convert to grayscale ────────────────── */

std::string save_grayscale(const std::string& in, const std::string& out)
{
    cv::Mat img = load_image(in, "color");
    cv::Mat gray;
    cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
    return save_image(out, gray);
}

/* ───────────────── 3. Add noise ───────────────────────────── */

std::string add_noise(const std::string& in,
                      const std::string& out,
                      const std::string& type,
                      double amount,
                      double sigma,
                      int uniform_range)
{
    cv::Mat img = load_image(in, "color");
    cv::Mat result = img.clone();

    if (type == "gaussian") {
        cv::Mat flt, noise;
        img.convertTo(flt, CV_32F);
        noise = cv::Mat::zeros(img.size(), flt.type());
        cv::randn(noise, 0.0, sigma);
        cv::Mat noisy = flt + noise;
        noisy.convertTo(result, img.type());

    } else if (type == "uniform") {
        cv::Mat flt, noise;
        img.convertTo(flt, CV_32F);
        noise = cv::Mat::zeros(img.size(), flt.type());
        cv::randu(noise, -uniform_range, uniform_range);
        cv::Mat noisy = flt + noise;
        noisy.convertTo(result, img.type());

    } else if (type == "salt_pepper") {
        amount = std::clamp(amount, 0.0, 1.0);
        int total = img.rows * img.cols;
        int count = static_cast<int>(total * amount * 0.5);
        cv::RNG rng(static_cast<uint64>(cv::getTickCount()));

        for (int i = 0; i < count; ++i) {
            int y = rng.uniform(0, img.rows), x = rng.uniform(0, img.cols);
            if (result.channels() == 1) result.at<uchar>(y, x) = 255;
            else result.at<cv::Vec3b>(y, x) = {255, 255, 255};
        }
        for (int i = 0; i < count; ++i) {
            int y = rng.uniform(0, img.rows), x = rng.uniform(0, img.cols);
            if (result.channels() == 1) result.at<uchar>(y, x) = 0;
            else result.at<cv::Vec3b>(y, x) = {0, 0, 0};
        }
    } else {
        throw std::runtime_error("Unknown noise type: " + type);
    }

    return save_image(out, result);
}

/* ───────────────── 4. Low-pass filter ─────────────────────── */
/*  FIX: sigma is now passed through correctly from Python.      */

std::string apply_low_pass_filter(const std::string& in,
                                  const std::string& out,
                                  const std::string& type,
                                  int ksize,
                                  double sigma)
{
    cv::Mat img = load_image(in, "color");
    cv::Mat result;
    ksize = ensure_odd_min3(ksize);

    if (type == "average") {
        cv::blur(img, result, {ksize, ksize});
    } else if (type == "gaussian") {
        // Pass sigma explicitly so changing it has visible effect.
        // ksize=0 lets OpenCV derive the kernel from sigma; we use the
        // user-supplied ksize but honour sigma as the primary parameter.
        cv::GaussianBlur(img, result, {ksize, ksize}, sigma, sigma);
    } else if (type == "median") {
        cv::medianBlur(img, result, ksize);
    } else {
        throw std::runtime_error("Unknown filter type: " + type);
    }

    return save_image(out, result);
}

/* ───────────────── 5. Edge detection ──────────────────────── */

py::dict detect_edges(const std::string& in,
                      const std::string& prefix,
                      const std::string& method,
                      int ksize,
                      double t1,
                      double t2)
{
    cv::Mat gray = load_image(in, "gray");
    py::dict out;
    out["method"] = method;

    if (method == "canny") {
        cv::Mat edges;
        cv::Canny(gray, edges, t1, t2);
        std::string p = prefix + "_canny.png";
        save_image(p, edges);
        out["edge"] = p;
        return out;
    }

    cv::Mat gx, gy;
    if (method == "sobel") {
        ksize = ensure_odd_min3(ksize);
        cv::Sobel(gray, gx, CV_32F, 1, 0, ksize);
        cv::Sobel(gray, gy, CV_32F, 0, 1, ksize);
    } else if (method == "prewitt") {
        cv::Mat kx = (cv::Mat_<float>(3,3) << -1,0,1, -1,0,1, -1,0,1);
        cv::Mat ky = (cv::Mat_<float>(3,3) << -1,-1,-1, 0,0,0, 1,1,1);
        cv::filter2D(gray, gx, CV_32F, kx);
        cv::filter2D(gray, gy, CV_32F, ky);
    } else if (method == "roberts") {
        cv::Mat kx = (cv::Mat_<float>(2,2) << 1,0, 0,-1);
        cv::Mat ky = (cv::Mat_<float>(2,2) << 0,1, -1,0);
        cv::filter2D(gray, gx, CV_32F, kx);
        cv::filter2D(gray, gy, CV_32F, ky);
    } else {
        throw std::runtime_error("Unknown edge method: " + method);
    }

    std::string xp = prefix + "_" + method + "_x.png";
    std::string yp = prefix + "_" + method + "_y.png";
    std::string mp = prefix + "_" + method + "_edge.png";

    save_image(xp, abs_preview(gx));
    save_image(yp, abs_preview(gy));
    save_image(mp, magnitude_preview(gx, gy));

    out["x"]    = xp;
    out["y"]    = yp;
    out["edge"] = mp;
    return out;
}

/* ───────────────── 6. Histogram & CDF ─────────────────────── */

py::dict draw_histogram_and_cdf(const std::string& in,
                                const std::string& hist_path,
                                const std::string& cdf_path,
                                const std::string& mode)
{
    cv::Mat img = load_image(in, mode == "rgb" ? "color" : "gray");

    constexpr int BINS = 256, W = 512, H = 400;
    const int bin_w = cvRound(static_cast<double>(W) / BINS);

    cv::Mat hist_canvas(H, W, CV_8UC3, cv::Scalar(255, 255, 255));
    cv::Mat cdf_canvas (H, W, CV_8UC3, cv::Scalar(255, 255, 255));

    std::vector<cv::Scalar> colors = {{255,0,0}, {0,255,0}, {0,0,255}};
    std::vector<cv::Mat> channels;

    if (img.channels() == 1) {
        channels.push_back(img);
        colors = {{0, 0, 0}};
    } else {
        cv::split(img, channels);
    }

    for (size_t c = 0; c < channels.size(); ++c) {
        int ch[]  = {0};
        int bins[] = {BINS};
        float range[] = {0, 256};
        const float* ranges[] = {range};

        cv::Mat hist;
        cv::calcHist(&channels[c], 1, ch, {}, hist, 1, bins, ranges);

        cv::Mat hn;
        cv::normalize(hist, hn, 0, H, cv::NORM_MINMAX);

        cv::Mat cdf = hist.clone();
        for (int i = 1; i < cdf.rows; ++i)
            cdf.at<float>(i) += cdf.at<float>(i - 1);
        cv::Mat cn;
        cv::normalize(cdf, cn, 0, H, cv::NORM_MINMAX);

        for (int i = 1; i < BINS; ++i) {
            cv::line(hist_canvas,
                     {bin_w*(i-1), H - cvRound(hn.at<float>(i-1))},
                     {bin_w*i,     H - cvRound(hn.at<float>(i))},
                     colors[c], 2);
            cv::line(cdf_canvas,
                     {bin_w*(i-1), H - cvRound(cn.at<float>(i-1))},
                     {bin_w*i,     H - cvRound(cn.at<float>(i))},
                     colors[c], 2);
        }
    }

    save_image(hist_path, hist_canvas);
    save_image(cdf_path,  cdf_canvas);

    py::dict out;
    out["histogram"] = hist_path;
    out["cdf"]       = cdf_path;
    out["mode"]      = mode;
    return out;
}

/* ───────────────── 7. Histogram equalization ──────────────── */
/*  FIX: now returns before/after histogram images as well.      */

py::dict equalize_image(const std::string& in,
                        const std::string& out_img,
                        const std::string& hist_before_path,
                        const std::string& hist_after_path)
{
    cv::Mat gray = load_image(in, "gray");
    cv::Mat eq;
    cv::equalizeHist(gray, eq);

    save_image(out_img, eq);
    save_image(hist_before_path, draw_gray_hist(gray));
    save_image(hist_after_path,  draw_gray_hist(eq));

    py::dict result;
    result["output"]       = out_img;
    result["hist_before"]  = hist_before_path;
    result["hist_after"]   = hist_after_path;
    return result;
}

/* ───────────────── 8. Normalize ───────────────────────────── */
/*  FIX: only minmax and inf are kept; l1/l2 removed.           */

std::string normalize_image(const std::string& in,
                            const std::string& out,
                            double alpha,
                            double beta,
                            const std::string& norm_type)
{
    cv::Mat img = load_image(in, "color");

    int cv_norm = cv::NORM_MINMAX;
    if (norm_type == "inf") cv_norm = cv::NORM_INF;

    cv::Mat dst;
    cv::normalize(img, dst, alpha, beta, cv_norm, img.type());
    return save_image(out, dst);
}

/* ───────────────── 9. Thresholding ────────────────────────── */
/*  FIX: simplified to binary thresholding only.                */

std::string apply_threshold(const std::string& in,
                            const std::string& out,
                            double thresh,
                            double max_val)
{
    cv::Mat gray = load_image(in, "gray");
    cv::Mat dst;
    cv::threshold(gray, dst, thresh, max_val, cv::THRESH_BINARY);
    return save_image(out, dst);
}

/* ───────────────── 10a. Frequency-domain filter ───────────── */

std::string frequency_filter(const std::string& in,
                             const std::string& out,
                             const std::string& type,
                             int cutoff)
{
    cv::Mat gray = load_image(in, "gray");
    cv::Mat flt;
    gray.convertTo(flt, CV_32F);

    cv::Mat planes[] = {flt, cv::Mat::zeros(gray.size(), CV_32F)};
    cv::Mat cpx;
    cv::merge(planes, 2, cpx);
    cv::dft(cpx, cpx);
    dft_shift(cpx);

    cutoff = std::max(1, cutoff);
    cv::Mat mask(gray.size(), CV_32F, cv::Scalar(0));
    cv::circle(mask, {mask.cols / 2, mask.rows / 2}, cutoff, cv::Scalar(1), -1);
    if (type == "high_pass")
        mask = cv::Scalar(1) - mask;

    cv::Mat fp[] = {mask, mask};
    cv::Mat cmask;
    cv::merge(fp, 2, cmask);
    cv::mulSpectrums(cpx, cmask, cpx, 0);

    dft_shift(cpx);
    cv::Mat inv;
    cv::idft(cpx, inv, cv::DFT_REAL_OUTPUT | cv::DFT_SCALE);
    cv::normalize(inv, inv, 0, 255, cv::NORM_MINMAX);

    cv::Mat dst;
    inv.convertTo(dst, CV_8U);
    return save_image(out, dst);
}

/* ───────────────── 10b. Hybrid image ──────────────────────── */

std::string hybrid_image(const std::string& low_path,
                         const std::string& high_path,
                         const std::string& out,
                         double low_sigma,
                         double high_sigma,
                         double mix)
{
    cv::Mat lo = load_image(low_path,  "color");
    cv::Mat hi = load_image(high_path, "color");

    if (lo.size() != hi.size())
        cv::resize(hi, hi, lo.size());

    cv::Mat lo_blur, hi_blur;
    cv::GaussianBlur(lo, lo_blur, {0, 0}, low_sigma);
    cv::GaussianBlur(hi, hi_blur, {0, 0}, high_sigma);

    cv::Mat hi_pass;
    cv::subtract(hi, hi_blur, hi_pass, cv::noArray(), CV_16S);

    cv::Mat lf, hf;
    lo_blur.convertTo(lf, CV_32F);
    hi_pass.convertTo(hf, CV_32F);

    mix = std::clamp(mix, 0.0, 1.0);
    cv::Mat hybrid = lf * mix + hf * (1.0 - mix);
    cv::normalize(hybrid, hybrid, 0, 255, cv::NORM_MINMAX);

    cv::Mat dst;
    hybrid.convertTo(dst, CV_8U);
    return save_image(out, dst);
}

/* ═══════════════════ pybind11 bindings ════════════════════════ */

PYBIND11_MODULE(cv_core, m)
{
    m.doc() = "C++ OpenCV core – all CV operations for CV_One";

    m.def("read_image_info", &read_image_info,
          "Read RGB / gray image metadata",
          py::arg("input_path"));

    m.def("save_grayscale", &save_grayscale,
          "Save grayscale copy of image",
          py::arg("input_path"), py::arg("output_path"));

    m.def("add_noise", &add_noise,
          "Add noise: gaussian | uniform | salt_pepper",
          py::arg("input_path"), py::arg("output_path"), py::arg("noise_type"),
          py::arg("amount") = 0.05, py::arg("sigma") = 25.0,
          py::arg("uniform_range") = 30);

    // FIX 1: sigma is now the primary blur parameter for gaussian
    m.def("apply_low_pass_filter", &apply_low_pass_filter,
          "Low-pass filter: average | gaussian | median",
          py::arg("input_path"), py::arg("output_path"), py::arg("filter_type"),
          py::arg("kernel_size") = 3, py::arg("sigma") = 1.0);

    m.def("detect_edges", &detect_edges,
          "Edge detection: sobel | prewitt | roberts | canny",
          py::arg("input_path"), py::arg("output_prefix"), py::arg("method"),
          py::arg("kernel_size") = 3,
          py::arg("threshold1") = 50.0, py::arg("threshold2") = 150.0);

    m.def("draw_histogram_and_cdf", &draw_histogram_and_cdf,
          "Draw histogram and CDF curves",
          py::arg("input_path"), py::arg("hist_output_path"),
          py::arg("cdf_output_path"), py::arg("mode") = "gray");

    // FIX 2: equalize_image now returns before/after histograms
    m.def("equalize_image", &equalize_image,
          "Histogram equalization (grayscale) with before/after histograms",
          py::arg("input_path"), py::arg("output_path"),
          py::arg("hist_before_path"), py::arg("hist_after_path"));

    // FIX 3: only minmax and inf remain
    m.def("normalize_image", &normalize_image,
          "Normalize: minmax | inf",
          py::arg("input_path"), py::arg("output_path"),
          py::arg("alpha") = 0.0, py::arg("beta") = 255.0,
          py::arg("norm_type") = "minmax");

    // FIX 4: simplified to binary only
    m.def("apply_threshold", &apply_threshold,
          "Binary thresholding",
          py::arg("input_path"), py::arg("output_path"),
          py::arg("threshold") = 127.0, py::arg("max_value") = 255.0);

    m.def("frequency_filter", &frequency_filter,
          "Frequency-domain filter: low_pass | high_pass",
          py::arg("input_path"), py::arg("output_path"),
          py::arg("filter_type") = "low_pass", py::arg("cutoff") = 30);

    m.def("hybrid_image", &hybrid_image,
          "Hybrid image from low + high frequency sources",
          py::arg("low_image_path"), py::arg("high_image_path"),
          py::arg("output_path"),
          py::arg("low_sigma") = 5.0, py::arg("high_sigma") = 3.0,
          py::arg("mix_weight") = 0.5);
}