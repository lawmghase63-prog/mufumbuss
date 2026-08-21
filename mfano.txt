<?php
require_once "../includes/config.php";

$exam_id          = isset($_GET['exam_id'])    ? (int)$_GET['exam_id']    : 0;
$form_level_filter = isset($_GET['form_level']) ? mysqli_real_escape_string($conn, $_GET['form_level']) : '';

// Load grade scale from grade_scales table; fall back to defaults if table not yet created
$_gs_q = mysqli_query($conn, "SELECT * FROM grade_scales ORDER BY min_marks DESC");
$_grade_scales = $_gs_q ? mysqli_fetch_all($_gs_q, MYSQLI_ASSOC) : [];
if (empty($_grade_scales)) {
    $_grade_scales = [
        ['grade_letter'=>'A','min_marks'=>75,'points'=>1,'remark'=>'BORA SANA'],
        ['grade_letter'=>'B','min_marks'=>65,'points'=>2,'remark'=>'VIZURI SANA'],
        ['grade_letter'=>'C','min_marks'=>45,'points'=>3,'remark'=>'WASTANI'],
        ['grade_letter'=>'D','min_marks'=>30,'points'=>4,'remark'=>'HAFIFU'],
        ['grade_letter'=>'F','min_marks'=>0, 'points'=>5,'remark'=>'FELI'],
    ];
}

function gradePoint($m) {
    global $_grade_scales;
    foreach ($_grade_scales as $gs) { if ($m >= $gs['min_marks']) return (int)$gs['points']; }
    return 5;
}
function gradeLetter($m) {
    global $_grade_scales;
    foreach ($_grade_scales as $gs) { if ($m >= $gs['min_marks']) return $gs['grade_letter']; }
    return 'F';
}
function gradeRemark($g) {
    global $_grade_scales;
    foreach ($_grade_scales as $gs) { if ($gs['grade_letter'] === $g) return $gs['remark']; }
    return '-';
}

// -----------------------------------------------------------------------
// Step 1: No form_level selected → show selector
// -----------------------------------------------------------------------
if (empty($form_level_filter)) {
    $form_levels = ['Form One', 'Form Two', 'Form Three', 'Form Four']; ?>
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Ripoti za Wanafunzi — Chagua Kidato</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
        .card{background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.08);padding:40px;width:100%;max-width:520px;}
        h2{color:#0b5e2e;font-size:24px;text-align:center;margin-bottom:6px;}
        .sub{text-align:center;color:#666;font-size:14px;margin-bottom:28px;}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .form-btn{display:flex;align-items:center;justify-content:center;padding:20px 12px;background:#f8f9fa;border:2px solid #e0e0e0;border-radius:12px;color:#333;font-size:15px;font-weight:700;text-decoration:none;transition:all .2s;text-align:center;min-height:80px;}
        .form-btn:hover{border-color:#0b5e2e;background:#e8f5e9;color:#0b5e2e;transform:translateY(-2px);box-shadow:0 6px 20px rgba(11,94,46,0.12);}
        .note{text-align:center;margin-top:24px;font-size:12px;color:#999;}
    </style></head><body>
    <div class="card">
        <h2>Ripoti za Wanafunzi</h2>
        <div class="sub">Chagua kidato cha wanafunzi</div>
        <div class="grid">
            <?php foreach ($form_levels as $fl): ?>
                <a href="?form_level=<?= urlencode($fl) ?>" class="form-btn"><?= htmlspecialchars($fl) ?></a>
            <?php endforeach; ?>
        </div>
        <div class="note">Kisha uchague mtihani ili kuzalisha ripoti za wanafunzi wote wa kidato husika</div>
    </div></body></html>
    <?php exit;
}

// -----------------------------------------------------------------------
// Step 2: form_level selected but no exam_id → show exams list
// -----------------------------------------------------------------------
if ($exam_id == 0) {
    $exam_list_query = mysqli_query($conn, "
        SELECT DISTINCT e.id, e.exam_name, e.start_date
        FROM exams e
        WHERE e.id IN (
            SELECT exam_id FROM exam_form_levels WHERE form_level = '$form_level_filter'
            UNION
            SELECT DISTINCT m.exam_id FROM marks m
            JOIN students s ON s.id = m.student_id AND s.is_active=1
            WHERE COALESCE(NULLIF(m.form_level,''), s.form_level) = '$form_level_filter'
        )
        ORDER BY e.start_date DESC, e.exam_name
    ");
    if (!$exam_list_query) die("Error fetching exams: " . mysqli_error($conn)); ?>
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Chagua Mtihani — <?= htmlspecialchars($form_level_filter) ?></title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
        .card{background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.08);padding:40px;width:100%;max-width:520px;}
        .badge{display:inline-block;background:#0b5e2e;color:#fff;padding:6px 18px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:6px;}
        h2{color:#0b5e2e;font-size:22px;margin-bottom:4px;text-align:center;}
        .sub{text-align:center;color:#666;font-size:14px;margin-bottom:24px;}
        .exam-btn{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;margin:8px 0;background:#f8f9fa;border:2px solid #e0e0e0;border-radius:12px;text-decoration:none;transition:all .2s;}
        .exam-btn:hover{border-color:#0b5e2e;background:#e8f5e9;transform:translateY(-1px);box-shadow:0 4px 15px rgba(11,94,46,0.1);}
        .exam-name{font-size:15px;font-weight:600;color:#333;}
        .exam-date{font-size:12px;color:#999;}
        .empty{text-align:center;color:#999;padding:30px 0;font-size:14px;}
    </style></head><body>
    <div class="card">
        <div class="badge"><?= htmlspecialchars(str_replace('Form ', 'F. ', $form_level_filter)) ?></div>
        <h2>Chagua Mtihani</h2>
        <div class="sub">Bonyeza mtihani kuona ripoti za wanafunzi wa <?= htmlspecialchars($form_level_filter) ?></div>
        <?php if (mysqli_num_rows($exam_list_query) == 0): ?><div class="empty">Hakuna matokeo yaliyopatikana kwa kidato hiki</div><?php endif; ?>
        <?php while ($exam_row = mysqli_fetch_assoc($exam_list_query)): ?>
            <a href="?exam_id=<?= $exam_row['id'] ?>&form_level=<?= urlencode($form_level_filter) ?>&pdf=1" class="exam-btn">
                <span class="exam-name"><?= htmlspecialchars($exam_row['exam_name']) ?></span>
                <span class="exam-date"><?= htmlspecialchars($exam_row['start_date']) ?></span>
            </a>
        <?php endwhile; ?>
    </div></body></html>
    <?php exit;
}

// -----------------------------------------------------------------------
// Generate reports for all students (shared data for both HTML and PDF)
// -----------------------------------------------------------------------

$exam_query = mysqli_query($conn, "SELECT exam_name, start_date, parent_message FROM exams WHERE id = $exam_id");
if (!$exam_query || mysqli_num_rows($exam_query) == 0) die("Exam not found.");
$exam = mysqli_fetch_assoc($exam_query);

// Check if processed results exist in summary table
$summary_check = mysqli_query($conn, "SELECT COUNT(*) as cnt FROM exam_results_summary WHERE exam_id = $exam_id AND form_level = '$form_level_filter'");
$has_summary = $summary_check && mysqli_fetch_assoc($summary_check)['cnt'] > 0;

if ($has_summary) {
    $total_students = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) as total FROM exam_results_summary WHERE exam_id = $exam_id AND form_level = '$form_level_filter'"))['total'];
    $all_summaries = mysqli_query($conn, "
        SELECT ers.*, s.first_name, s.second_name, s.last_name, s.sex, s.stream
        FROM exam_results_summary ers
        JOIN students s ON s.id = ers.student_id AND s.is_active=1
        WHERE ers.exam_id = $exam_id AND ers.form_level = '$form_level_filter'
        ORDER BY ers.position ASC, s.first_name ASC
    ");
    if (!$all_summaries) die("Error fetching results: " . mysqli_error($conn));
} else {
    $has_fl_marks = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) as cnt FROM marks WHERE exam_id = $exam_id AND form_level = '$form_level_filter'"))['cnt'] > 0;
    $marks_fl_sql = $has_fl_marks ? " AND m.form_level = '$form_level_filter'" : '';
    $mark_students = mysqli_query($conn, "
        SELECT DISTINCT m.student_id, s.first_name, s.second_name, s.last_name, s.sex, s.stream
        FROM marks m
        JOIN students s ON s.id = m.student_id AND s.is_active=1
        JOIN student_subjects ss ON ss.student_id = m.student_id AND ss.subject_id = m.subject_id
        WHERE m.exam_id = $exam_id $marks_fl_sql
    ");
    if (!$mark_students || mysqli_num_rows($mark_students) == 0) die("No results found for this exam.");
    $student_rows = [];
    while ($ms = mysqli_fetch_assoc($mark_students)) {
        $inner_fl_sql = $has_fl_marks ? " AND form_level = '$form_level_filter'" : '';
        $m_q = mysqli_query($conn, "SELECT m.marks FROM marks m JOIN student_subjects ss ON ss.student_id = m.student_id AND ss.subject_id = m.subject_id WHERE m.exam_id = $exam_id AND m.student_id = {$ms['student_id']} $inner_fl_sql");
        $total_marks = 0; $subject_count = 0; $all_pts_r = [];
        while ($mv = mysqli_fetch_assoc($m_q)) {
            $mk = (float)$mv['marks']; $total_marks += $mk; $subject_count++;
            $all_pts_r[] = gradePoint($mk);
        }
        sort($all_pts_r);
        $total_pts = array_sum(array_slice($all_pts_r, 0, 7));
        $avg_marks = $subject_count > 0 ? round($total_marks / $subject_count, 2) : 0;
        $student_rows[] = ['student_id' => $ms['student_id'], 'first_name' => $ms['first_name'], 'second_name' => $ms['second_name'], 'last_name' => $ms['last_name'], 'sex' => $ms['sex'], 'stream' => $ms['stream'], 'form_level' => $form_level_filter, 'average_marks' => $avg_marks, 'total_points' => $total_pts, 'division' => '', 'total_marks' => $total_marks, 'parent_message' => ''];
    }
    usort($student_rows, function($a, $b) { if ($a['total_points'] != $b['total_points']) return $a['total_points'] - $b['total_points']; return $b['average_marks'] <=> $a['average_marks']; });
    $total_students = count($student_rows); $rank = 1;
    for ($i = 0; $i < $total_students; $i++) {
        if ($i > 0 && ($student_rows[$i]['total_points'] != $student_rows[$i-1]['total_points'] || $student_rows[$i]['average_marks'] != $student_rows[$i-1]['average_marks'])) $rank = $i + 1;
        $student_rows[$i]['position'] = $rank;
    }
    $all_summaries = $student_rows;
}

// -----------------------------------------------------------------------
// FPDF generation
// -----------------------------------------------------------------------
    require_once "../vendor/fpdf.php";

    class SchPdf extends FPDF {
        protected $exam_name;
        protected $form_level;
        protected $total_students;
        public function setMeta($en, $fl, $ts) { $this->exam_name = $en; $this->form_level = $fl; $this->total_students = $ts; }

        function Header() {
            $logoPath = __DIR__ . '/../assets/logo.png';
            $logoSize = 26; // mm - square
            $startY   = $this->GetY();

            if (file_exists($logoPath)) {
                $this->Image($logoPath, 10, $startY, $logoSize, $logoSize);
                $this->SetY($startY); // reset Y so text draws alongside logo
            }

            $this->SetFont('Times', '', 10);
            $this->Cell(0, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'HALMASHAURI YA WILAYA YA IRAMBA'), 0, 1, 'C');
            $this->SetFont('Times', 'B', 16);
            $this->Cell(0, 8, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'SHULE YA AMALI KITUKUTU'), 0, 1, 'C');
            $this->SetFont('Times', '', 10);
            $this->Cell(0, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'S.L.P 155, IRAMBA'), 0, 1, 'C');
            $this->SetFont('Times', 'B', 12);
            $this->Cell(0, 6, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'RIPOTI YA MATOKEO - ' . strtoupper($this->exam_name)), 0, 1, 'C');

            // ensure Y clears the logo if text was shorter
            if (file_exists($logoPath)) {
                $this->SetY(max($this->GetY(), $startY + $logoSize));
            }

            $this->Line(10, $this->GetY() + 1, 200, $this->GetY() + 1);
            $this->Ln(2);
        }

        function StudentInfo($full_name, $sex, $stream, $avg, $date) {
            $this->SetFillColor(224, 242, 224);
            $this->SetFont('Times', 'B', 11);
            $this->Cell(0, 6.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', "JINA: $full_name"), 1, 1, 'L', true);
            $this->SetFont('Times', '', 10);
            $left = iconv('UTF-8', 'ISO-8859-1//TRANSLIT', "Kidato: {$this->form_level}   |   Mkondo: " . ($stream ?: '-') . "   |   Jinsia: $sex");
            $right = iconv('UTF-8', 'ISO-8859-1//TRANSLIT', "Tarehe: $date   |   Wastani: " . number_format($avg, 2) . "%");
            $this->Cell(120, 6, $left, 1, 0, 'L', true);
            $this->Cell(70, 6, $right, 1, 1, 'R', true);
            $this->SetFillColor(255, 255, 255);
            $this->Ln(5);
        }

        function SubjectTable($marks_data, $gpa, $position, $total_points, $division) {
            $w = [80, 26, 20, 18, 46]; // 190mm total: SOMO|ALAMA|DARAJA|POINTI|MAONI
            $this->SetFillColor(180, 220, 180);
            $this->SetFont('Times', 'B', 10);
            $this->Cell($w[0], 6, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'SOMO'), 1, 0, 'C', true);
            $this->Cell($w[1], 6, 'ALAMA', 1, 0, 'C', true);
            $this->Cell($w[2], 6, 'DARAJA', 1, 0, 'C', true);
            $this->Cell($w[3], 6, 'POINTI', 1, 0, 'C', true);
            $this->Cell($w[4], 6, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'MAONI'), 1, 1, 'C', true);
            $this->SetFont('Times', '', 10);
            foreach ($marks_data as $i => $md) {
                $this->SetFillColor($i % 2 == 0 ? 255 : 245, $i % 2 == 0 ? 255 : 250, $i % 2 == 0 ? 255 : 245);
                $this->Cell($w[0], 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $md['subject']), 1, 0, 'L', true);
                $this->Cell($w[1], 5.5, (string)$md['marks'], 1, 0, 'C', true);
                $this->Cell($w[2], 5.5, $md['grade'], 1, 0, 'C', true);
                $this->Cell($w[3], 5.5, (string)$md['point'], 1, 0, 'C', true);
                $this->Cell($w[4], 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', gradeRemark($md['grade'])), 1, 1, 'C', true);
            }
            $this->SetFillColor(224, 242, 224);
            $this->SetFont('Times', 'B', 10);
            $gpa_line = iconv('UTF-8', 'ISO-8859-1//TRANSLIT', "GPA: " . number_format($gpa, 2) . "   |   Nafasi: $position / {$this->total_students}   |   Jumla Pointi: $total_points");
            if ($division) $gpa_line .= "   |   Division: $division";
            $this->Cell(array_sum($w), 5.5, $gpa_line, 1, 1, 'R', true);
            $this->SetFillColor(255, 255, 255);
            $this->Ln(5);
        }

        function HistoryTable($prev_data) {
            $this->SetFont('Times', 'B', 10);
            $this->Cell(0, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'Historia ya Mitihani - ' . $this->form_level), 0, 1, 'C');
            $hw = [66, 22, 26, 20, 20, 22, 14]; // 190mm total
            $this->SetFillColor(180, 220, 180);
            $this->SetFont('Times', 'B', 9.5);
            $this->Cell($hw[0], 6, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'MTIHANI'), 1, 0, 'C', true);
            $this->Cell($hw[1], 6, 'TAREHE', 1, 0, 'C', true);
            $this->Cell($hw[2], 6, 'WASTANI', 1, 0, 'C', true);
            $this->Cell($hw[3], 6, 'NAFASI', 1, 0, 'C', true);
            $this->Cell($hw[4], 6, 'DARAJA', 1, 0, 'C', true);
            $this->Cell($hw[5], 6, 'POINTI', 1, 0, 'C', true);
            $this->Cell($hw[6], 6, 'MWE', 1, 1, 'C', true);
            $this->SetFont('Times', '', 9.5);
            if (empty($prev_data)) {
                $this->SetFillColor(255, 255, 255);
                $this->Cell(array_sum($hw), 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'Hakuna matokeo ya mitihani ya awali.'), 1, 1, 'C');
            } else {
                foreach ($prev_data as $i => $pr) {
                    $this->SetFillColor($i % 2 == 0 ? 255 : 245, $i % 2 == 0 ? 255 : 250, $i % 2 == 0 ? 255 : 245);
                    $pa = (float)$pr['average_marks'];
                    $pg = gradeLetter($pa);
                    $trend = '';
                    if ($i < count($prev_data) - 1) {
                        $next = (float)$prev_data[$i+1]['average_marks'];
                        if ($pa > $next) $trend = chr(30);
                        elseif ($pa < $next) $trend = chr(31);
                    }
                    $this->Cell($hw[0], 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $pr['exam_name']), 1, 0, 'L', true);
                    $this->Cell($hw[1], 5.5, date('d/m/y', strtotime($pr['start_date'])), 1, 0, 'C', true);
                    $this->Cell($hw[2], 5.5, number_format($pa, 1) . '%', 1, 0, 'C', true);
                    $this->Cell($hw[3], 5.5, (string)(int)$pr['position'], 1, 0, 'C', true);
                    $this->Cell($hw[4], 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $pr['division'] ?: $pg), 1, 0, 'C', true);
                    $this->Cell($hw[5], 5.5, (string)(int)$pr['total_points'], 1, 0, 'C', true);
                    $this->Cell($hw[6], 5.5, $trend ?: '-', 1, 1, 'C', true);
                }
            }
            $this->SetFillColor(255, 255, 255);
            $this->Ln(5);
        }

        function BehaviorTable() {
            $this->SetFont('Times', 'B', 10);
            $this->Cell(0, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'Tabia na Mwenendo'), 0, 1, 'C');
            $bw = [9, 63, 23, 9, 63, 23]; // 190mm total
            $this->SetFillColor(180, 220, 180);
            $this->SetFont('Times', 'B', 9);
            $this->Cell($bw[0], 6, 'NO', 1, 0, 'C', true);
            $this->Cell($bw[1], 6, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'MAELEZO'), 1, 0, 'C', true);
            $this->Cell($bw[2], 6, 'ALAMA', 1, 0, 'C', true);
            $this->Cell($bw[3], 6, 'NO', 1, 0, 'C', true);
            $this->Cell($bw[4], 6, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'MAELEZO'), 1, 0, 'C', true);
            $this->Cell($bw[5], 6, 'ALAMA', 1, 1, 'C', true);
            $rows = [
                ['1', 'KUFANYA KAZI KWA BIDII', '5', 'HESHIMA KWA WALIMU NA WANAFUNZI'],
                ['2', 'KUPENDA KUHESHIMU NA KUTHAMINI KAZI', '6', 'KUTII NA KUFUATA MAAGIZO'],
                ['3', 'UANGALIFU WA MALI ZA UMA', '7', 'USAFI BINAFSI'],
                ['4', 'UELEWA NA USHIRIKIANO', '8', 'KUSHIRIKI SHUGHULI ZA UTAMADUNI'],
            ];
            $this->SetFont('Times', '', 8.5);
            foreach ($rows as $i => $r) {
                $this->SetFillColor($i % 2 == 0 ? 255 : 245, $i % 2 == 0 ? 255 : 250, $i % 2 == 0 ? 255 : 245);
                $this->Cell($bw[0], 5.5, $r[0], 1, 0, 'C', true);
                $this->Cell($bw[1], 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $r[1]), 1, 0, 'L', true);
                $this->Cell($bw[2], 5.5, '____', 1, 0, 'C', true);
                $this->Cell($bw[3], 5.5, $r[2], 1, 0, 'C', true);
                $this->Cell($bw[4], 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $r[3]), 1, 0, 'L', true);
                $this->Cell($bw[5], 5.5, '____', 1, 1, 'C', true);
            }
            $this->SetFillColor(255, 255, 255);
            $this->Ln(5);
        }

        function CommentBox($label, $text, $fill = false) {
            $this->SetFont('Times', 'B', 10);
            $this->Cell(0, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $label), 0, 1, 'C');
            $this->SetFont('Times', '', 9.5);
            if ($fill) $this->SetFillColor(255, 246, 229);
            $this->MultiCell(0, 5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $text), 0, 'L', $fill);
            if ($fill) $this->SetFillColor(255, 255, 255);
            $this->Ln(0.5);
        }

        function ParentMsg($text) {
            $this->SetFont('Times', 'B', 10);
            $this->Cell(0, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'Ujumbe kwa Mzazi / Mlezi'), 0, 1, 'C');
            $this->SetFont('Times', '', 9.5);
            $this->SetFillColor(255, 246, 229);
            $this->MultiCell(0, 5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $text), 0, 'L', true);
            $this->SetFillColor(255, 255, 255);
            $this->Ln(2);
        }

        function Signatures() {
            $sigY = max($this->GetY() + 4, $this->GetPageHeight() - 32);
            $this->SetY($sigY);
            $sw = 190 / 3;
            $this->SetFont('Times', '', 10);
            $s = '_______________________';
            $this->Cell($sw, 5.5, $s, 0, 0, 'C');
            $this->Cell($sw, 5.5, $s, 0, 0, 'C');
            $this->Cell($sw, 5.5, $s, 0, 1, 'C');
            $this->SetFont('Times', 'B', 9);
            $this->Cell($sw, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'MWALIMU WA DARASA'), 0, 0, 'C');
            $this->Cell($sw, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'MWALIMU WA TAALUMA'), 0, 0, 'C');
            $this->Cell($sw, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'MKUU WA SHULE'), 0, 1, 'C');
        }

        function Footer() {
            $this->SetY(-12);
            $this->SetFont('Times', '', 8);
            $d = iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'Ripoti hii imetolewa na Ofisi ya Taaluma | Tarehe: ' . date('d/m/Y'));
            $this->Cell(0, 4.5, $d, 0, 0, 'C');
        }
    }

    // Collect all student data
    $students_data = [];
    foreach (is_array($all_summaries) ? $all_summaries : (function() use ($all_summaries) { $r = []; while ($row = mysqli_fetch_assoc($all_summaries)) $r[] = $row; return $r; })() as $sum) {
        $student_id = $sum['student_id'];
        $full_name = trim($sum['first_name'] . ' ' . $sum['second_name'] . ' ' . $sum['last_name']);
        $subs = mysqli_query($conn, "
            SELECT sub.subject_name, m.marks
            FROM marks m JOIN subjects sub ON sub.id = m.subject_id
            JOIN student_subjects ss ON ss.student_id = m.student_id AND ss.subject_id = m.subject_id
            WHERE m.exam_id = $exam_id AND m.student_id = $student_id AND m.form_level = '$form_level_filter'
            ORDER BY sub.subject_name
        ");
        $marks_data = []; $all_pts_d = []; $gpa_sum = 0; $total_sub = 0;
        while ($s = mysqli_fetch_assoc($subs)) {
            $mk = (float)$s['marks']; $p = gradePoint($mk);
            $all_pts_d[] = $p; $gpa_sum += $p; $total_sub++;
            $marks_data[] = ['subject' => $s['subject_name'], 'marks' => $mk, 'grade' => gradeLetter($mk), 'point' => $p];
        }
        // GPA uses all subjects; total_points uses best 7 only (Tanzania grading)
        $gpa = $total_sub > 0 ? round($gpa_sum / $total_sub, 2) : 0;
        sort($all_pts_d);
        $total_points = array_sum(array_slice($all_pts_d, 0, 7));
        $avg = (float)$sum['average_marks'];

        $prev_q = mysqli_query($conn, "
            SELECT e.exam_name, e.start_date, ers.average_marks, ers.position, ers.total_points, ers.division
            FROM exam_results_summary ers JOIN exams e ON e.id = ers.exam_id
            WHERE ers.student_id = $student_id AND ers.form_level = '$form_level_filter' AND ers.exam_id != $exam_id
            ORDER BY e.start_date DESC
        ");
        $prev_data = [];
        if ($prev_q) { while ($pr = mysqli_fetch_assoc($prev_q)) $prev_data[] = $pr; }

        if ($avg >= 75) $comment = 'Ufaulu wa juu sana. Hongera mwanafunzi. Endelea kudumisha ukakamali wako.';
        elseif ($avg >= 65) $comment = 'Ufaulu mzuri. Ongeza juhudi kidogo ili kufikia ubora zaidi.';
        elseif ($avg >= 45) $comment = 'Ufaulu wa wastani. Jitahidi zaidi ili kuboresha matokeo yako.';
        elseif ($avg >= 30) $comment = 'Ufaulu wa chini. Mzazi ashirikiane na shule ili kumsaidia mwanafunzi.';
        else $comment = 'Ufaulu hafifu. Mzazi anashauriwa kufika shuleni kwa mazungumzo ya kina.';

        // Always auto-generate based on the selected exam's actual data
        $parent_msg = "Mzazi mpendwa wa $full_name, matokeo ya '{$exam['exam_name']}' yamehitimishwa. Amepata wastani wa " . number_format($avg, 2) . "% nafasi ya {$sum['position']} kati ya wanafunzi $total_students. ";
        if ($avg >= 75) $parent_msg .= 'Hongera kwa matokeo bora. Endelea kumhimiza mwanafunzi kudumisha ukakamali huu.';
        elseif ($avg >= 65) $parent_msg .= 'Matokeo mazuri. Msaidie mwanafunzi kuongeza muda wa kusoma nyumbani.';
        elseif ($avg >= 45) $parent_msg .= 'Matokeo ya wastani. Hakikisha anafanya kazi za nyumbani na kujisomea zaidi.';
        elseif ($avg >= 30) $parent_msg .= 'Matokeo dhaifu. Tafadhali wasiliana na mwalimu wa darasa ili kujua changamoto.';
        else $parent_msg .= 'Matokeo duni sana. Inashauriwa kufika shuleni kwa ushauri na kufuatilia maendeleo.';
        // Append admin's custom note (if set) as additional info — never replace the auto-generated part
        $custom_note = trim($exam['parent_message'] ?? '');
        if (!empty($custom_note)) $parent_msg .= ' ' . $custom_note;

        $students_data[] = [
            'full_name' => $full_name, 'sex' => $sum['sex'], 'stream' => $sum['stream'],
            'avg' => $avg, 'marks_data' => $marks_data, 'gpa' => $gpa,
            'total_points' => $total_points, 'total_sub' => $total_sub,
            'prev_data' => $prev_data, 'comment' => $comment, 'parent_msg' => $parent_msg,
            'student_id' => $student_id, 'position' => $sum['position'], 'sum' => $sum,
        ];
    }

    $pdf = new SchPdf('P', 'mm', 'A4');
    $pdf->setMeta($exam['exam_name'], $form_level_filter, $total_students);
    $pdf->SetAutoPageBreak(true, 14);
    $pdf->SetMargins(10, 7, 10);

    foreach ($students_data as $sd) {
        $pdf->AddPage();
        $pdf->StudentInfo($sd['full_name'], $sd['sex'], $sd['stream'], $sd['avg'], $exam['start_date']);
        $pdf->SubjectTable($sd['marks_data'], $sd['gpa'], $sd['position'], $sd['total_points'], $sd['sum']['division'] ?? '');
        $pdf->HistoryTable($sd['prev_data']);
        $pdf->BehaviorTable();
        $pdf->SetFont('Times', 'B', 10);
        $pdf->Cell(0, 5.5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'Maoni ya Shule'), 0, 1, 'C');
        $pdf->SetFont('Times', '', 9.5);
        $pdf->MultiCell(0, 5, iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $sd['comment']), 0, 'L');
        $pdf->Ln(3);
        $stats = iconv('UTF-8', 'ISO-8859-1//TRANSLIT', "Pointi: {$sd['total_points']} | GPA: " . number_format($sd['gpa'], 2) . " | Nafasi: {$sd['position']} / $total_students | Wastani: " . number_format($sd['avg'], 1) . "%");
        $pdf->ParentMsg($stats . "\n" . $sd['parent_msg']);
        $pdf->Signatures();
    }

    $safe_name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $exam['exam_name']);
    $pdf->Output('D', 'Ripoti_' . $safe_name . '_' . str_replace(' ', '', $form_level_filter) . '.pdf');
    exit;
