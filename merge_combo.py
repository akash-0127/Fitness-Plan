#!/usr/bin/env python3
"""Merge Meal Plan.html and Workout Plan.html into Combo Plan.html"""
import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def extract_section(html, start_marker, end_marker, include_start=True, include_end=False):
    """Extract text between markers."""
    s = html.find(start_marker)
    if s == -1: return ''
    if not include_start:
        s = html.find('\n', s) + 1
    e = html.find(end_marker, s)
    if e == -1: return html[s:]
    if include_end:
        e = html.find('\n', e + len(end_marker))
        if e == -1: e = len(html)
    return html[s:e]

meal = read_file('Meal Plan.html')
workout = read_file('Workout Plan.html')

# ============================================================
# BUILD THE COMBO FILE
# ============================================================
parts = []

# --- HEAD ---
parts.append('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Coach Akash Singh — Combo Plan Generator v1.0</title>
<style>
''')

# --- SHARED CSS (from Workout Plan, which is cleaner) ---
# Extract CSS from workout plan (lines between <style> and </style>)
ws_css_start = workout.find('<style>') + 7
ws_css_end = workout.find('</style>')
parts.append(workout[ws_css_start:ws_css_end])

# --- COMBO-SPECIFIC CSS ADDITIONS ---
parts.append('''
/* COMBO ADDITIONS */
.combo-badge{background:linear-gradient(135deg,#1a3a1a,#2d6a0f);color:#7eca5a;font-size:0.7rem;padding:4px 12px;border-radius:999px;font-weight:700;margin-top:6px;display:inline-block}
.section-divider{border:none;border-top:2px solid var(--border);margin:1.25rem 0}
.tab-row{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:1.25rem}
.tab{flex:1;text-align:center;padding:10px 8px;font-size:0.82rem;font-weight:700;cursor:pointer;background:var(--bg);color:var(--muted);border-bottom:3px solid transparent;transition:all 0.15s}
.tab.active{color:#111;border-bottom-color:#111;background:var(--card)}
.tab:hover:not(.active){background:#f0efe8}
</style>
''')

parts.append('</head>\n<body>\n')

# --- LOADING OVERLAY ---
parts.append('''<div class="loading" id="loading">
  <div class="spinner"></div>
  <div class="lt" id="lt">Building your combo plan...</div>
</div>
''')

# --- HEADER ---
parts.append('''<div class="header">
  <div class="hl">
    <h1>Coach <span>Akash Singh</span></h1>
    <p>"Eat right, train hard — results are inevitable."</p>
    <div class="hbadge combo-badge">🍽️💪 Combo Plan Generator — Nutrition + Training</div>
  </div>
  <div class="hr">
    <a href="https://instagram.com/akash.liftsup" target="_blank">@akash.liftsup</a>
    <div style="font-size:0.7rem;color:#777;margin-top:3px">Science-Based Coaching · No Fluff</div>
  </div>
</div>
''')

parts.append('<div class="wrap">\n')

# --- VALIDATION BANNER ---
parts.append('<div class="vbanner" id="vbanner"></div>\n')

# ============================================================
# COMBINED FORM CARD
# ============================================================
parts.append('<div class="card">\n')

# PERSONAL DETAILS
parts.append('''<div class="stitle">👤 Personal Details</div>
<div class="row">
  <div class="fg">
    <label>Client Name <span class="req">*</span></label>
    <input type="text" id="cName" placeholder="e.g. Rahul Sharma"/>
    <span class="ferr" id="eName">Name is required</span>
  </div>
  <div class="fg">
    <label>Phone (+91) <span class="req">*</span></label>
    <input type="tel" id="phone" placeholder="98765 43210" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')"/>
    <span class="ferr" id="ePhone">Enter valid 10-digit Indian number</span>
  </div>
  <div class="fg">
    <label>Email <span class="req">*</span></label>
    <input type="email" id="email" placeholder="rahul@email.com"/>
    <span class="ferr" id="eEmail">Enter valid email address</span>
  </div>
  <div class="fg">
    <label>Age <span class="req">*</span></label>
    <input type="number" id="age" placeholder="25" min="15" max="80"/>
    <span class="ferr" id="eAge">Enter age (15–80)</span>
  </div>
  <div class="fg">
    <label>Weight <span class="req">*</span></label>
    <div class="unit-row">
      <input type="number" id="wt" placeholder="70" min="15" max="450"/>
      <div class="unit-toggle" id="weightUnit">
        <div class="unit-btn active" data-val="kg" onclick="setUnit('weight',this)">kg</div>
        <div class="unit-btn" data-val="lbs" onclick="setUnit('weight',this)">lbs</div>
      </div>
    </div>
    <span class="ferr" id="eWt">Enter realistic weight</span>
  </div>
  <div class="fg">
    <label>Height <span class="req">*</span></label>
    <div class="unit-row">
      <input type="number" id="ht" placeholder="170" min="36" max="300"/>
      <div class="unit-toggle" id="heightUnit">
        <div class="unit-btn active" data-val="cm" onclick="setUnit('height',this)">cm</div>
        <div class="unit-btn" data-val="in" onclick="setUnit('height',this)">in</div>
      </div>
    </div>
    <span class="ferr" id="eHt">Enter realistic height</span>
  </div>
  <div class="fg">
    <label>Gender</label>
    <div class="chips">
      <div class="chip on" data-g="gender" data-v="male">&#x2642; Male</div>
      <div class="chip" data-g="gender" data-v="female">&#x2640; Female</div>
    </div>
  </div>
</div>
''')

# GOAL & ACTIVITY
parts.append('''<div class="stitle">🎯 Goal & Activity</div>
<div class="row">
  <div class="fg">
    <label>Fitness Goal</label>
    <div class="chips">
      <div class="chip on" data-g="goal" data-v="fatloss">&#x1F525; Fat Loss</div>
      <div class="chip" data-g="goal" data-v="musclegain">&#x1F4AA; Muscle Gain</div>
      <div class="chip" data-g="goal" data-v="recomp">&#x2696; Recomposition</div>
      <div class="chip" data-g="goal" data-v="strength">&#x1F3CB; Strength</div>
      <div class="chip" data-g="goal" data-v="endurance">&#x1F3C3; Endurance</div>
      <div class="chip" data-g="goal" data-v="maintenance">&#x1F504; Maintenance</div>
    </div>
  </div>
</div>
<div class="row">
  <div class="fg">
    <label>Activity Level</label>
    <div class="chips">
      <div class="chip" data-g="activity" data-v="sedentary">Sedentary</div>
      <div class="chip on" data-g="activity" data-v="lightly">Lightly Active</div>
      <div class="chip" data-g="activity" data-v="moderate">Moderately Active</div>
      <div class="chip" data-g="activity" data-v="very">Very Active</div>
      <div class="chip" data-g="activity" data-v="extreme">Athlete</div>
    </div>
  </div>
  <div class="fg">
    <label>Training Days/Week</label>
    <div class="chips">
      <div class="chip" data-g="tdays" data-v="3">3 Days</div>
      <div class="chip on" data-g="tdays" data-v="4">4 Days</div>
      <div class="chip" data-g="tdays" data-v="5">5 Days</div>
      <div class="chip" data-g="tdays" data-v="6">6 Days</div>
    </div>
  </div>
</div>
''')

# DIET PREFERENCE
parts.append('''<div class="stitle">🥗 Diet Preference</div>
<div class="dchips" id="dietChips">
  <div class="dchip on" data-diet="veg_dairy">🥦 Vegetarian<span class="dchip-sub">Dairy ok · No eggs · No meat</span></div>
  <div class="dchip" data-diet="eggetarian">🥚 Eggetarian<span class="dchip-sub">Eggs + dairy ok · No meat</span></div>
  <div class="dchip" data-diet="nonveg">🍗 Non-Veg<span class="dchip-sub">Chicken · Fish · Eggs · Dairy</span></div>
  <div class="dchip" data-diet="vegan">🌱 Vegan<span class="dchip-sub">No animal products</span></div>
  <div class="dchip" data-diet="pescatarian">🐟 Pescatarian<span class="dchip-sub">Fish & eggs ok · No meat</span></div>
  <div class="dchip" data-diet="keto">🥑 Keto<span class="dchip-sub">High fat · Very low carb</span></div>
</div>
''')

# TRAINING SETUP
parts.append('''<div class="stitle">&#x1F3CB; Training Setup</div>
<div class="row">
  <div class="fg"><label>Location</label>
    <div class="chips">
      <div class="chip on" data-g="training" data-v="gym">&#x1F3CB; Gym</div>
      <div class="chip" data-g="training" data-v="home">&#x1F3E0; Home</div>
    </div>
  </div>
  <div class="fg"><label>Fitness Level</label>
    <div class="chips">
      <div class="chip on" data-g="level" data-v="beginner">Beginner</div>
      <div class="chip" data-g="level" data-v="intermediate">Intermediate</div>
      <div class="chip" data-g="level" data-v="advanced">Advanced</div>
    </div>
  </div>
  <div class="fg"><label>Session Duration</label>
    <div class="chips">
      <div class="chip" data-g="duration" data-v="45">45 min</div>
      <div class="chip on" data-g="duration" data-v="60">60 min</div>
      <div class="chip" data-g="duration" data-v="90">90 min</div>
    </div>
  </div>
  <div class="fg"><label>Workout Timing</label>
    <div class="chips">
      <div class="chip on" data-g="timing" data-v="morning">&#x1F305; Morning</div>
      <div class="chip" data-g="timing" data-v="evening">&#x1F306; Evening</div>
      <div class="chip" data-g="timing" data-v="flexible">&#x23F1; Flexible</div>
    </div>
  </div>
</div>
''')

# TRAINING SCHEDULE + SPLIT
parts.append('''<div class="stitle">&#x1F4C5; Training Schedule</div>
<div class="row" style="align-items:flex-start">
  <div class="fg">
    <label>Days Per Week</label>
    <div class="chips">
      <div class="chip" data-g="days" data-v="3">3 Days</div>
      <div class="chip on" data-g="days" data-v="4">4 Days</div>
      <div class="chip" data-g="days" data-v="5">5 Days</div>
      <div class="chip" data-g="days" data-v="6">6 Days</div>
    </div>
  </div>
  <div class="fg" style="flex:1;min-width:280px">
    <label>Training Split <span id="splitBadge"></span></label>
    <div class="sc-wrap" id="splitChips"></div>
    <div class="split-ex" id="splitEx"></div>
  </div>
</div>
''')

# HOME EQUIPMENT (hidden by default)
parts.append('''<div id="homeEquip" style="display:none;margin-bottom:1.25rem">
  <div class="fg"><label>Home Equipment</label>
    <div class="chips">
      <div class="chip on" data-g="equipment" data-v="none">None / Bodyweight</div>
      <div class="chip" data-g="equipment" data-v="dumbbells">Dumbbells</div>
      <div class="chip" data-g="equipment" data-v="bands">Resistance Bands</div>
      <div class="chip" data-g="equipment" data-v="full">Full Setup</div>
    </div>
  </div>
</div>
''')

# CUSTOMISATION
parts.append('''<div class="stitle">&#x1F3AF; Customisation</div>
<div class="row">
  <div class="fg"><label>Priority / Weak Point</label>
    <div class="chips">
      <div class="chip on" data-g="priority" data-v="none">No Preference</div>
      <div class="chip" data-g="priority" data-v="chest">Chest</div>
      <div class="chip" data-g="priority" data-v="back">Back</div>
      <div class="chip" data-g="priority" data-v="legs">Legs</div>
      <div class="chip" data-g="priority" data-v="glutes">Glutes</div>
      <div class="chip" data-g="priority" data-v="arms">Arms</div>
    </div>
  </div>
  <div class="fg"><label>Injury / Limitation</label>
    <div class="chips">
      <div class="chip on" data-g="injury" data-v="none">None</div>
      <div class="chip" data-g="injury" data-v="knee">Knee Issue</div>
      <div class="chip" data-g="injury" data-v="shoulder">Shoulder Issue</div>
      <div class="chip" data-g="injury" data-v="back">Lower Back</div>
      <div class="chip" data-g="injury" data-v="wrist">Wrist Issue</div>
    </div>
  </div>
</div>
<div class="row">
  <div class="fg"><label>Cardio Preference</label>
    <div class="chips">
      <div class="chip on" data-g="cardio" data-v="both">LISS + HIIT</div>
      <div class="chip" data-g="cardio" data-v="liss">LISS Only</div>
      <div class="chip" data-g="cardio" data-v="hiit">HIIT Only</div>
      <div class="chip" data-g="cardio" data-v="none">No Cardio</div>
    </div>
  </div>
  <div class="fg"><label>Meals Per Day</label>
    <div class="chips">
      <div class="chip" data-g="meals" data-v="3">3 Meals</div>
      <div class="chip on" data-g="meals" data-v="4">4 Meals</div>
      <div class="chip" data-g="meals" data-v="5">5 Meals</div>
      <div class="chip" data-g="meals" data-v="6">6 Meals</div>
    </div>
  </div>
</div>
''')

# LIFESTYLE & HEALTH
parts.append('''<div class="stitle" style="margin-top:1.25rem">⚙️ Lifestyle & Health</div>
<div class="row">
  <div class="fg"><label>Budget</label>
    <div class="chips">
      <div class="chip" data-g="budget" data-v="low">Low (Budget)</div>
      <div class="chip on" data-g="budget" data-v="medium">Medium</div>
      <div class="chip" data-g="budget" data-v="high">High / Premium</div>
    </div>
  </div>
  <div class="fg"><label>Cooking Time</label>
    <div class="chips">
      <div class="chip on" data-g="cooktime" data-v="15">15 min</div>
      <div class="chip" data-g="cooktime" data-v="30">30 min</div>
      <div class="chip" data-g="cooktime" data-v="60">60 min</div>
    </div>
  </div>
  <div class="fg">
    <label>Health Conditions <span style="font-weight:400;color:#aaa;font-size:0.62rem">(select all)</span></label>
    <div class="chips" id="healthChips">
      <div class="hchip on" data-v="none">None</div>
      <div class="hchip" data-v="diabetes">Diabetes/IR</div>
      <div class="hchip" data-v="thyroid">Thyroid</div>
      <div class="hchip" data-v="pcos">PCOS/PCOD</div>
      <div class="hchip" data-v="cholesterol">High Cholesterol</div>
      <div class="hchip" data-v="bp">Hypertension</div>
    </div>
  </div>
</div>
''')

# PLAN VERSION
parts.append('''<div class="row">
  <div class="fg"><label>Plan Version</label>
    <div class="chips">
      <div class="chip on" data-g="plantype" data-v="normal">Normal Plan</div>
      <div class="chip" data-g="plantype" data-v="premium">⭐ Premium Plan</div>
    </div>
  </div>
</div>
''')

# NAVY METHOD
parts.append('''<div class="navy">
  <div class="navy-t">&#x1F4CF; Body Measurements — Navy Method Body Fat Calculator (Optional)</div>
  <div class="row" style="margin-bottom:0;gap:1rem">
    <div class="fg"><label>Waist (cm)</label><input type="number" id="waist" placeholder="e.g. 85" style="width:100px"/></div>
    <div class="fg"><label>Neck (cm)</label><input type="number" id="neck" placeholder="e.g. 38" style="width:100px"/></div>
    <div class="fg" id="hipGrp" style="display:none"><label>Hip (cm) — females</label><input type="number" id="hip" placeholder="e.g. 95" style="width:100px"/></div>
    <div class="fg" style="justify-content:flex-end">
      <label style="visibility:hidden">x</label>
      <button onclick="calcBMI()"
        style="border:1.5px solid var(--border);background:var(--gl);color:var(--green);border-radius:var(--rs);padding:9px 16px;font-size:0.79rem;font-weight:700;cursor:pointer;white-space:nowrap">
        &#x1F4CA; Calculate BMI &amp; Body Fat %
      </button>
    </div>
  </div>
  <div class="navy-h">&#x1F4A1; Optional — measurements give accurate body fat %. Otherwise BMI estimate is used automatically.</div>
</div>
''')

# BMI RESULT
parts.append('''<div id="bmiPanel">
  <div style="font-size:0.67rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--green);margin-bottom:0.75rem">&#x1F4CA; Body Composition Analysis</div>
  <div class="bmi-inner">
    <div class="bmi-s"><div class="bmi-v" id="bmiV">-</div><div class="bmi-l">BMI</div><div class="bmi-c" id="bmiC">-</div></div>
    <div class="bmi-div"></div>
    <div class="bmi-s"><div class="bmi-v" id="fatV">-</div><div class="bmi-l">Body Fat %</div><div class="bmi-c" id="fatC">-</div></div>
    <div class="bmi-div"></div>
    <div class="bmi-s"><div class="bmi-v" id="leanV">-</div><div class="bmi-l">Lean Mass</div><div class="bmi-c" id="fmV" style="font-size:0.7rem;color:var(--muted)">-</div></div>
    <div class="bmi-bw">
      <div style="font-size:0.69rem;color:var(--muted);margin-bottom:4px" id="bmiNote">-</div>
      <div class="bmi-bar"><div class="bmi-fill" id="bmiFill"></div></div>
      <div class="bmi-labs"><span>Underweight</span><span>Normal</span><span>Overweight</span><span>Obese</span></div>
    </div>
  </div>
</div>
''')

# BUTTONS
parts.append('''<div style="display:flex;gap:10px;margin-top:1.5rem;flex-wrap:wrap">
  <button class="gbtn" onclick="generate('normal')">🍽️💪 Generate Combo Plan</button>
  <button class="gbtn pbtn" onclick="generate('premium')">&#x2B50; Generate Premium Plan</button>
  <span style="font-size:0.72rem;color:var(--muted)">Works offline · No internet needed</span>
</div>
''')

parts.append('</div><!-- /card -->\n')

# ============================================================
# OUTPUT SECTION
# ============================================================
parts.append('<div class="output" id="output">\n')

# PLAN HEADER
parts.append('''<div class="ph">
  <div>
    <div class="pbrand">Coach Akash Singh &middot; Personalised Combo Plan</div>
    <div class="ptitle" id="outTitle">-</div>
    <div class="psub" id="outSub">-</div>
    <div class="badges" id="outBadges"></div>
  </div>
  <div style="text-align:right;font-size:0.72rem;color:var(--muted)">
    <div style="font-size:1.5rem">🍽️💪</div>
  </div>
</div>
''')

# STATS
parts.append('<div class="stats" id="outStats"></div>\n')

# BODY COMP ROW
parts.append('''<div id="bcRow" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:var(--rs);padding:0.85rem 1.1rem;margin-bottom:1.25rem">
  <div id="bcContent" style="display:flex;flex-wrap:wrap;gap:1.25rem"></div>
</div>
''')

# CALCULATIONS
parts.append('''<div class="slbl">📊 Your Calculations</div>
<div class="sf">
  <div class="sh">BMR → TDEE → Target Calories → Macros</div>
  <div id="outCalc"></div>
</div>
''')

# TRAINING DAY MEALS
parts.append('''<div class="slbl" id="trainingDayLbl">🏋️ Training Day Meal Plan</div>
<div class="sf" id="outMealsWrap">
  <div class="sh" id="mealPlanHead">Daily Meal Schedule — Pick Any 1 Option Per Meal</div>
  <div id="outMeals"></div>
</div>
''')

# REST DAY MEALS
parts.append('''<div class="slbl">😴 Rest Day Meal Plan <span style="font-size:0.62rem;font-weight:400;text-transform:none;letter-spacing:0;color:var(--blue)">Carbs reduced 20–25% · Same protein</span></div>
<div class="sf">
  <div class="sh">Rest Day Schedule <span class="rest-badge">REST DAY</span></div>
  <div id="outRestMeals"></div>
</div>
''')

# SEEDS
parts.append('''<div class="slbl">🌱 Power Seeds — Add Daily</div>
<div class="sg" id="outSeeds"></div>
''')

# SUPPLEMENTS
parts.append('''<div class="slbl" id="suppLbl">💊 Recommended Supplements</div>
<div class="sg" id="outSupps"></div>
''')

# WORKOUT PLAN
parts.append('''<div id="normalSec">
  <div class="slbl">Workout Plan</div>
  <div class="sf"><div class="sh">&#x1F4C5; Weekly Workout Schedule</div><div id="outWk"></div></div>
  <div class="slbl">&#x1F4C8; Progressive Overload</div>
  <div class="sf"><div class="sh">Week-by-Week Progression Guide</div><div id="outProg"></div></div>
</div>
''')

# PREMIUM WORKOUT
parts.append('''<div id="premSec" style="display:none">
  <div class="slbl gold">&#x2B50; Premium Workout Plan</div>
  <div class="sf"><div class="sh">&#x2B50; Premium Schedule <span class="ptag">Premium</span></div><div id="outWkP"></div></div>
  <div class="pnote" id="outPN"></div>
  <div class="slbl gold">&#x1F4C8; 8-Week Periodization</div>
  <div class="sf"><div class="sh">Progressive Overload Plan <span class="ptag">Premium</span></div><div id="outPeriod"></div></div>
</div>
''')

# CARDIO
parts.append('''<div class="slbl">&#x1F3C3; Cardio</div>
<div class="ib ib-blue" style="margin-bottom:1.25rem"><h3>LISS + HIIT Protocol</h3><div class="cg" id="outCardio"></div></div>
''')

# STRETCHING
parts.append('''<div class="slbl">&#x1F9D8; Stretching &amp; Mobility</div>
<div class="sf"><div class="sh">Daily Stretching Routine</div><div id="outStretch"></div></div>
''')

# RECOVERY
parts.append('''<div class="slbl">&#x1F634; Recovery Strategy</div>
<div class="rg" id="outRecov"></div>
''')

# INJURY ALERT
parts.append('<div id="injAlert"></div>\n')

# INJURY PREVENTION
parts.append('<div class="ib ib-orange" style="margin-bottom:1.25rem"><h3>Injury Prevention Tips</h3><ul id="outInj"></ul></div>\n')

# RULES
parts.append('''<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
  <div class="ib ib-green"><h3>✅ Training Rules</h3><ul id="outWkRules"></ul></div>
  <div class="ib ib-red"><h3>❌ Training Avoid</h3><ul id="outWkAvoid"></ul></div>
</div>
''')

# MEAL RULES
parts.append('''<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
  <div class="ib ib-green"><h3>✅ Nutrition Rules</h3><ul id="outMealRules"></ul></div>
  <div class="ib ib-red"><h3>❌ Nutrition Avoid</h3><ul id="outMealAvoid"></ul></div>
</div>
''')

# SMART SWAPS
parts.append('''<div class="slbl">🔄 Smart Food Swaps</div>
<div class="ib ib-blue" id="outSwaps"><h3>If you don't have X → use Y</h3><ul></ul></div>
''')

# HEALTH NOTE
parts.append('<div id="healthNote" style="display:none"></div>\n')

# CARB CYCLING (premium)
parts.append('''<div class="slbl" id="carbCycleLbl" style="display:none">🔄 Carb Cycling Weekly Overview <span style="font-size:0.62rem;font-weight:400;text-transform:none;letter-spacing:0;color:var(--gold)">Premium Strategy</span></div>
<div id="carbCycleWrap" style="display:none;margin-bottom:1.25rem"></div>
''')

# WEEKLY MEAL PREP GUIDE
parts.append('''<div class="slbl">📦 Weekly Meal Prep Guide</div>
<div class="sf">
  <div class="sh">Sunday Batch Cook — Save 45 Min Every Day</div>
  <div id="outPrepGuide"></div>
</div>
''')

# PROGRESS TRACKING
parts.append('''<div class="slbl">📈 Progress Tracking Protocol</div>
<div id="outProgress"></div>
''')

# PREMIUM MEAL PANEL
parts.append('''<div id="premiumMealPanel" style="display:none;margin-bottom:1.25rem">
  <div class="slbl" style="color:var(--gold)">⭐ Premium Nutrition Strategies</div>
  <div id="premiumMealContent"></div>
</div>
''')

# COACH NOTES
parts.append('''<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
  <div class="ib ib-dark" id="outMealCoach"></div>
  <div class="ib ib-dark" id="outWkCoach"></div>
</div>
''')

# EXPORT
parts.append('''<div id="printWrap" style="display:flex;gap:10px;flex-wrap:wrap">
  <button class="btn btn-p" onclick="doCopy()">&#x1F4CB; Copy Plan</button>
  <button class="btn" onclick="window.print()">&#x1F5A8; Print / Save PDF</button>
</div>
''')

parts.append('</div><!-- /output -->\n')

# FOOTER
parts.append('''<div class="footer">Designed by <a href="https://instagram.com/akash.liftsup">Coach Akash Singh</a> &middot; @akash.liftsup &middot; Personal Coaching Use Only</div>
</div><!-- /wrap -->
''')

# ============================================================
# JAVASCRIPT
# ============================================================
parts.append('<script>\n')

# --- WORKOUT DATA (SPLITS, RR, GYM, FGYM, HOME, CARDIO, STRETCH, RECOV, INJ_PREV, INJ_MODS, PROG, PERIOD) ---
# Extract from workout file: everything between first <script> and </script>
wk_js_start = workout.find('<script>') + 8
wk_js_end = workout.rfind('</script>')
wk_js = workout[wk_js_start:wk_js_end]

# Extract just the data section (PART 2) from workout
wk_part2_start = wk_js.find('// PART 2: ALL DATA')
wk_part3_start = wk_js.find('// PART 3: ALL LOGIC')
wk_data = wk_js[wk_part2_start:wk_part3_start] if wk_part2_start >= 0 and wk_part3_start >= 0 else ''

# Extract PART 3 logic from workout
wk_logic = wk_js[wk_part3_start:] if wk_part3_start >= 0 else ''

# --- MEAL DATA ---
meal_js_start = meal.find('<script>') + 8
meal_js_end = meal.rfind('</script>')
meal_js = meal[meal_js_start:meal_js_end]

# ============================================================
# Write workout data
# ============================================================
parts.append('// ============================================================\n')
parts.append('// WORKOUT DATA\n')
parts.append('// ============================================================\n')
parts.append(wk_data)

# ============================================================
# Write meal data
# ============================================================
parts.append('\n// ============================================================\n')
parts.append('// MEAL DATA\n')
parts.append('// ============================================================\n')

# Extract MEAL_PLANS, HEALTH_NOTES, SEEDS_DATA, SUPPS_DATA, SWAPS from meal file
meal_data_markers = ['var MEAL_PLANS', 'var HEALTH_NOTES', 'var SEEDS_DATA', 'var SUPPS_DATA', 'var SWAPS', 'var PREP_GUIDE', 'var PROGRESS_DATA', 'var PREMIUM_DATA']
meal_rules_markers = ['var RULES', 'var AVOID', 'var COACH_NOTES']

# Find meal-specific data blocks
meal_section = meal_js

# Extract MEAL_PLANS
mp_start = meal_section.find('var MEAL_PLANS')
mp_end_marker = 'var HEALTH_NOTES'
mp_end = meal_section.find(mp_end_marker, mp_start)
if mp_start >= 0 and mp_end >= 0:
    parts.append(meal_section[mp_start:mp_end])

# Extract HEALTH_NOTES
hn_start = meal_section.find('var HEALTH_NOTES')
hn_end = meal_section.find('var SEEDS_DATA', hn_start)
if hn_start >= 0 and hn_end >= 0:
    parts.append(meal_section[hn_start:hn_end])

# Extract SEEDS_DATA
sd_start = meal_section.find('var SEEDS_DATA')
sd_end = meal_section.find('var SUPPS_DATA', sd_start)
if sd_start >= 0 and sd_end >= 0:
    parts.append(meal_section[sd_start:sd_end])

# Extract SUPPS_DATA
sp_start = meal_section.find('var SUPPS_DATA')
sp_end = meal_section.find('var SWAPS', sp_start)
if sp_start >= 0 and sp_end >= 0:
    parts.append(meal_section[sp_start:sp_end])

# Extract SWAPS
sw_start = meal_section.find('var SWAPS')
sw_end = meal_section.find('var RULES', sw_start)
if sw_start >= 0 and sw_end >= 0:
    parts.append(meal_section[sw_start:sw_end])

# Rename meal RULES/AVOID/COACH_NOTES to MEAL_RULES etc.
meal_rules_start = meal_section.find('var RULES')
meal_rules_end = meal_section.find('var AVOID', meal_rules_start)
if meal_rules_start >= 0 and meal_rules_end >= 0:
    block = meal_section[meal_rules_start:meal_rules_end]
    block = block.replace('var RULES', 'var MEAL_RULES')
    parts.append(block)

meal_avoid_start = meal_section.find('var AVOID')
meal_avoid_end = meal_section.find('var COACH_NOTES', meal_avoid_start)
if meal_avoid_start >= 0 and meal_avoid_end >= 0:
    block = meal_section[meal_avoid_start:meal_avoid_end]
    block = block.replace('var AVOID', 'var MEAL_AVOID')
    parts.append(block)

# COACH_NOTES → MEAL_COACH (meal version)
meal_coach_start = meal_section.find('var COACH_NOTES')
# Find the end - it's followed by function setUnit
meal_coach_end = meal_section.find('function setUnit', meal_coach_start)
if meal_coach_start >= 0 and meal_coach_end >= 0:
    block = meal_section[meal_coach_start:meal_coach_end]
    block = block.replace('var COACH_NOTES', 'var MEAL_COACH')
    parts.append(block)

# PREP_GUIDE (only write once, it's duplicated in source)
pg_start = meal_section.find('var PREP_GUIDE')
if pg_start >= 0:
    # Find the LAST occurrence (deduplicated)
    pg_end = meal_section.find('function buildPrepGuide', pg_start)
    if pg_end >= 0:
        parts.append(meal_section[pg_start:pg_end])

# PROGRESS_DATA
pd_start = meal_section.find('var PROGRESS_DATA')
pd_end = meal_section.find('var PREMIUM_DATA', pd_start)
if pd_start >= 0 and pd_end >= 0:
    parts.append(meal_section[pd_start:pd_end])

# PREMIUM_DATA
pp_start = meal_section.find('var PREMIUM_DATA')
pp_end = meal_section.find('function buildPremiumPanel', pp_start)
if pp_start >= 0 and pp_end >= 0:
    parts.append(meal_section[pp_start:pp_end])

# Rename workout RULES/AVOID/COACH_NOTES
wk_rules_block = ''
wk_rules_start = wk_logic.find('var RULES')
if wk_rules_start >= 0:
    wk_rules_block_end = wk_logic.find('var AVOID', wk_rules_start)
    if wk_rules_block_end >= 0:
        wk_rules_block = wk_logic[wk_rules_start:wk_rules_block_end]
        wk_rules_block = wk_rules_block.replace('var RULES', 'var WK_RULES')
        parts.append('\n// Workout Rules (renamed to WK_RULES)\n')
        parts.append(wk_rules_block)

wk_avoid_start = wk_logic.find('var AVOID')
if wk_avoid_start >= 0:
    wk_avoid_block_end = wk_logic.find('var COACH_NOTES', wk_avoid_start)
    if wk_avoid_block_end >= 0:
        wk_avoid_block = wk_logic[wk_avoid_start:wk_avoid_block_end]
        wk_avoid_block = wk_avoid_block.replace('var AVOID', 'var WK_AVOID')
        parts.append('\n// Workout Avoid (renamed to WK_AVOID)\n')
        parts.append(wk_avoid_block)

wk_coach_start = wk_logic.find('var COACH_NOTES')
if wk_coach_start >= 0:
    wk_coach_block_end = wk_logic.find('var PREM_NOTES', wk_coach_start)
    if wk_coach_block_end >= 0:
        wk_coach_block = wk_logic[wk_coach_start:wk_coach_block_end]
        wk_coach_block = wk_coach_block.replace('var COACH_NOTES', 'var WK_COACH')
        parts.append('\n// Workout Coach Notes (renamed to WK_COACH)\n')
        parts.append(wk_coach_block)

# PREM_NOTES (workout)
pm_start = wk_logic.find('var PREM_NOTES')
if pm_start >= 0:
    pm_end = wk_logic.find('// PART 3:', pm_start)
    if pm_end < 0: pm_end = wk_logic.find('function', pm_start + 10)
    if pm_end >= 0:
        parts.append('\n// Workout Premium Notes\n')
        parts.append(wk_logic[pm_start:pm_end])

# ============================================================
# COMBINED LOGIC
# ============================================================
parts.append('\n// ============================================================\n')
parts.append('// COMBINED LOGIC\n')
parts.append('// ============================================================\n')

# STATE
parts.append('''var S = {
  goal:'fatloss', level:'beginner', training:'gym', gender:'male',
  days:'4', split:'upperlower', equipment:'none',
  duration:'60', timing:'morning', priority:'none',
  injury:'none', cardio:'both',
  diet:'veg_dairy', meals:'4', budget:'medium', cooktime:'30',
  health:['none'], stress:'low', plantype:'normal', tdays:'4'
};
''')

# buildSplits (from workout)
bs_start = wk_logic.find('function buildSplits')
bs_end = wk_logic.find('// CHIP HANDLER')
if bs_start >= 0 and bs_end >= 0:
    parts.append(wk_logic[bs_start:bs_end])

# Chip handlers (combined)
parts.append('''
// CHIP HANDLERS (combined)
var chips = document.querySelectorAll('.chip');
for (var ci = 0; ci < chips.length; ci++) {
  (function(c) {
    c.onclick = function() {
      var g = c.getAttribute('data-g');
      var v = c.getAttribute('data-v');
      var group = document.querySelectorAll('[data-g="' + g + '"]');
      for (var gi = 0; gi < group.length; gi++) group[gi].classList.remove('on');
      c.classList.add('on');
      S[g] = v;
      if (g === 'days') buildSplits(v);
      if (g === 'training') document.getElementById('homeEquip').style.display = v === 'home' ? 'block' : 'none';
      if (g === 'gender') document.getElementById('hipGrp').style.display = v === 'female' ? '' : 'none';
      calcBMI();
    };
  })(chips[ci]);
}
// Health chips — multi-select
var hchips = document.querySelectorAll('.hchip');
for (var hi = 0; hi < hchips.length; hi++) {
  (function(c) {
    c.onclick = function() {
      var v = c.getAttribute('data-v');
      if (v === 'none') {
        for (var i = 0; i < hchips.length; i++) hchips[i].classList.remove('on');
        c.classList.add('on');
        S.health = ['none'];
      } else {
        var noneChip = document.querySelector('.hchip[data-v="none"]');
        if (noneChip) noneChip.classList.remove('on');
        S.health = S.health.filter(function(x) { return x !== 'none'; });
        if (c.classList.contains('on')) {
          c.classList.remove('on');
          S.health = S.health.filter(function(x) { return x !== v; });
          if (S.health.length === 0) {
            if (noneChip) noneChip.classList.add('on');
            S.health = ['none'];
          }
        } else {
          c.classList.add('on');
          if (S.health.indexOf(v) === -1) S.health.push(v);
        }
      }
    };
  })(hchips[hi]);
}
var dchips = document.querySelectorAll('.dchip');
for (var di = 0; di < dchips.length; di++) {
  (function(c) {
    c.onclick = function() {
      for (var i = 0; i < dchips.length; i++) dchips[i].classList.remove('on');
      c.classList.add('on');
      S.diet = c.getAttribute('data-diet');
    };
  })(dchips[di]);
}
// INIT
buildSplits('4');
document.getElementById('hipGrp').style.display = 'none';
['wt','ht','age','waist','neck','hip'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.addEventListener('input', calcBMI);
});
''')

# calcBMI (from workout, enhanced)
parts.append('''
// BMI CALCULATOR (enhanced)
function calcBMI() {
  var wt = parseFloat(document.getElementById('wt').value) || 70;
  var ht = parseFloat(document.getElementById('ht').value) || 170;
  var age = parseFloat(document.getElementById('age').value) || 25;
  var waist = parseFloat(document.getElementById('waist').value) || 0;
  var neck = parseFloat(document.getElementById('neck').value) || 0;
  var hip = parseFloat(document.getElementById('hip').value) || 0;
  var g = S.gender;
  var htM = ht / 100;
  var bmi = wt / (htM * htM);
  var fat;
  if (g === 'male' && waist > 0 && neck > 0) {
    fat = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(ht) + 36.76;
  } else if (g === 'female' && waist > 0 && neck > 0 && hip > 0) {
    fat = 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(ht) - 78.387;
  } else {
    fat = (1.20 * bmi) + (0.23 * age) - (10.8 * (g === 'male' ? 1 : 0)) - 5.4;
  }
  fat = Math.max(3, Math.min(60, fat));
  var lean = wt - (fat / 100 * wt);
  var fm = (fat / 100 * wt);
  var bmiCat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  var bmiCol = bmi < 18.5 ? '#185FA5' : bmi < 25 ? '#2d6a0f' : bmi < 30 ? '#b96b10' : '#712B13';
  var fatCat, fatCol;
  if (g === 'male') { fatCat = fat < 14 ? 'Athletic' : fat < 18 ? 'Fitness' : fat < 25 ? 'Average' : 'High'; fatCol = fat < 18 ? '#2d6a0f' : fat < 25 ? '#b96b10' : '#712B13'; }
  else { fatCat = fat < 21 ? 'Athletic' : fat < 25 ? 'Fitness' : fat < 32 ? 'Average' : 'High'; fatCol = fat < 25 ? '#2d6a0f' : fat < 32 ? '#b96b10' : '#712B13'; }
  document.getElementById('bmiV').textContent = bmi.toFixed(1);
  document.getElementById('bmiC').textContent = bmiCat;
  document.getElementById('bmiC').style.color = bmiCol;
  document.getElementById('fatV').textContent = fat.toFixed(1) + '%';
  document.getElementById('fatC').textContent = fatCat;
  document.getElementById('fatC').style.color = fatCol;
  document.getElementById('leanV').textContent = lean.toFixed(1) + ' kg';
  document.getElementById('fmV').textContent = 'Fat: ' + fm.toFixed(1) + ' kg';
  document.getElementById('bmiNote').textContent = 'BMI ' + bmi.toFixed(1) + ' — ' + bmiCat;
  var pct = Math.min(100, ((bmi - 10) / 30) * 100);
  document.getElementById('bmiFill').style.width = pct + '%';
  var fillC = {Underweight:'#185FA5', Normal:'#7eca5a', Overweight:'#e8a020', Obese:'#c0392b'};
  document.getElementById('bmiFill').style.background = fillC[bmiCat] || '#7eca5a';
  document.getElementById('bmiPanel').style.display = 'block';
}
''')

# setUnit
parts.append('''
function setUnit(type, el) {
  var c = document.getElementById(type + 'Unit');
  if (!c) return;
  c.querySelectorAll('.unit-btn').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
}
''')

# calcMetrics (from meal)
cm_start = meal_section.find('function calcMetrics')
cm_end = meal_section.find('// MEAL DATA', cm_start)
if cm_start >= 0 and cm_end >= 0:
    parts.append(meal_section[cm_start:cm_end])

# validate (combined)
parts.append('''
function validate() {
  var ok = true;
  function chk(id, eid, bad) {
    var el = document.getElementById(id), er = document.getElementById(eid);
    if (!el || !er) return;
    if (bad) { el.classList.add('err'); er.classList.add('on'); ok = false; }
    else { el.classList.remove('err'); er.classList.remove('on'); }
  }
  chk('cName', 'eName', !document.getElementById('cName').value.trim());
  var phone = document.getElementById('phone').value.replace(/\\s/g, '');
  chk('phone', 'ePhone', !/^[6-9]\\d{9}$/.test(phone));
  var email = document.getElementById('email').value.trim();
  chk('email', 'eEmail', !email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email));
  var age = parseFloat(document.getElementById('age').value);
  chk('age', 'eAge', !age || age < 15 || age > 80);
  var wt = parseFloat(document.getElementById('wt').value);
  var wtU = document.querySelector('#weightUnit .unit-btn.active');
  var wtKg = (wtU && wtU.dataset.val === 'lbs') ? wt / 2.205 : wt;
  chk('wt', 'eWt', !wt || wtKg < 20 || wtKg > 300);
  var ht = parseFloat(document.getElementById('ht').value);
  var htU = document.querySelector('#heightUnit .unit-btn.active');
  var htCm = (htU && htU.dataset.val === 'in') ? ht * 2.54 : ht;
  chk('ht', 'eHt', !ht || htCm < 100 || htCm > 260);
  var b = document.getElementById('vbanner');
  if (!ok) { b.textContent = '\\u26A0\\uFE0F Please fill all required fields correctly.'; b.classList.add('on'); }
  else b.classList.remove('on');
  return ok;
}
''')

# getWDs (from workout)
gwd_start = wk_logic.find('function getWDs')
gwd_end = wk_logic.find('function renderWDs')
if gwd_start >= 0 and gwd_end >= 0:
    parts.append(wk_logic[gwd_start:gwd_end])

# renderWDs (from workout)
rwd_start = wk_logic.find('function renderWDs')
rwd_end = wk_logic.find('function renderProg')
if rwd_start >= 0 and rwd_end >= 0:
    parts.append(wk_logic[rwd_start:rwd_end])

# renderProg (from workout)
rp_start = wk_logic.find('function renderProg')
rp_end = wk_logic.find('function renderPeriod')
if rp_start >= 0 and rp_end >= 0:
    parts.append(wk_logic[rp_start:rp_end])

# renderPeriod (from workout)
rper_start = wk_logic.find('function renderPeriod')
rper_end = wk_logic.find('function getCardio')
if rper_start >= 0 and rper_end >= 0:
    parts.append(wk_logic[rper_start:rper_end])

# getCardio (from workout)
gc_start = wk_logic.find('function getCardio')
gc_end = wk_logic.find('// GENERATE', gc_start)
if gc_start >= 0 and gc_end >= 0:
    parts.append(wk_logic[gc_start:gc_end])

# Meal helper functions
for func_name in ['function buildMeals', 'function getSlotTime']:
    fs = meal_section.find(func_name)
    if fs >= 0:
        # Find the end (next function or marker)
        fe = meal_section.find('\nfunction ', fs + 10)
        if fe < 0: fe = meal_section.find('\n// ', fs + 10)
        if fe >= 0:
            parts.append(meal_section[fs:fe])
            parts.append('\n')

# Helper functions
parts.append('''
// HELPERS
function st(v,l){return '<div class="stat"><div class="stat-v">'+v+'</div><div class="stat-l">'+l+'</div></div>';}
function bci(v,l){return '<div style="text-align:center"><div style="font-size:1.1rem;font-weight:800;color:#111">'+v+'</div><div style="font-size:0.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px">'+l+'</div></div>';}
function ctr(a,b,c){return '<tr><td style="font-weight:700;white-space:nowrap">'+a+'</td><td style="color:var(--muted);font-size:0.8rem">'+b+'</td><td style="font-weight:700;color:var(--blue)">'+c+'</td></tr>';}
function bc(h,b){return '<div class="bonus-card"><div class="bonus-head">'+h+'</div><div class="bonus-body">'+b+'</div></div>';}
''')

# buildCarbCycling (from meal)
bcc_start = meal_section.find('function buildCarbCycling')
bcc_end = meal_section.find('var PREP_GUIDE', bcc_start)
if bcc_start >= 0 and bcc_end >= 0:
    parts.append(meal_section[bcc_start:bcc_end])

# buildPrepGuide (from meal) - only first occurrence
bpg_start = meal_section.find('function buildPrepGuide')
if bpg_start >= 0:
    bpg_end = meal_section.find('\n// ', bpg_start + 20)
    if bpg_end >= 0:
        parts.append(meal_section[bpg_start:bpg_end])
        parts.append('\n')

# buildProgress (from meal)
bp_start = meal_section.find('function buildProgress')
if bp_start >= 0:
    bp_end = meal_section.find('\nvar PREMIUM_DATA', bp_start)
    if bp_end < 0: bp_end = meal_section.find('\nfunction buildPremiumPanel', bp_start)
    if bp_end >= 0:
        parts.append(meal_section[bp_start:bp_end])
        parts.append('\n')

# buildPremiumPanel (from meal)
bpp_start = meal_section.find('function buildPremiumPanel')
if bpp_start >= 0:
    bpp_end = meal_section.find('\n// COPY PLAN', bpp_start)
    if bpp_end < 0: bpp_end = meal_section.find('function doCopy', bpp_start)
    if bpp_end >= 0:
        parts.append(meal_section[bpp_start:bpp_end])
        parts.append('\n')

# ============================================================
# GENERATE FUNCTION (combined)
# ============================================================
parts.append('''
// ============================================================
// GENERATE FUNCTION (combined)
// ============================================================
function generate(mode) {
  if (!validate()) return;
  var wtU = document.querySelector('#weightUnit .unit-btn.active');
  var htU = document.querySelector('#heightUnit .unit-btn.active');
  var wtEl = document.getElementById('wt');
  var htEl = document.getElementById('ht');
  var origWt = wtEl.value, origHt = htEl.value;
  if (wtU && wtU.dataset.val === 'lbs' && origWt) wtEl.value = (parseFloat(origWt) / 2.205).toFixed(1);
  if (htU && htU.dataset.val === 'in' && origHt) htEl.value = (parseFloat(origHt) * 2.54).toFixed(1);
  var msgs = ['Calculating your macros...','Designing your workout split...','Building meal plan...','Adding supplements & recovery...','Almost ready...'];
  var mi = 0;
  document.getElementById('lt').textContent = msgs[0];
  document.getElementById('loading').classList.add('on');
  var iv = setInterval(function() { mi = (mi + 1) % msgs.length; document.getElementById('lt').textContent = msgs[mi]; }, 600);
  setTimeout(function() {
    clearInterval(iv);
    document.getElementById('loading').classList.remove('on');
    try {
      renderMealPlan(mode);
      renderWorkoutPlan(mode);
    } catch(err) {
      alert('ERROR: ' + err.message + '\\n' + err.stack);
      console.error(err);
    }
    wtEl.value = origWt;
    htEl.value = origHt;
  }, 2000);
}
''')

# ============================================================
# RENDER MEAL PLAN (adapted from meal file)
# ============================================================
# Copy the meal renderPlan function but rename to renderMealPlan
# and fix references to MEAL_RULES, MEAL_AVOID, MEAL_COACH
meal_render_start = meal_section.find('function renderPlan(mode)')
meal_render_end = meal_section.find('function buildMeals')
if meal_render_start >= 0 and meal_render_end >= 0:
    meal_render = meal_section[meal_render_start:meal_render_end]
    meal_render = meal_render.replace('function renderPlan(mode)', 'function renderMealPlan(mode)')
    meal_render = meal_render.replace('RULES[goalKey]', 'MEAL_RULES[goalKey]')
    meal_render = meal_render.replace('AVOID[goalKey]', 'MEAL_AVOID[goalKey]')
    meal_render = meal_render.replace('COACH_NOTES[goalKey]', 'MEAL_COACH[goalKey]')
    meal_render = meal_render.replace('RULES.maintenance', 'MEAL_RULES.maintenance')
    meal_render = meal_render.replace('AVOID.maintenance', 'MEAL_AVOID.maintenance')
    meal_render = meal_render.replace('COACH_NOTES.maintenance', 'MEAL_COACH.maintenance')
    meal_render = meal_render.replace("document.getElementById('premiumPanel')", "document.getElementById('premiumMealPanel')")
    meal_render = meal_render.replace("document.getElementById('premiumContent')", "document.getElementById('premiumMealContent')")
    parts.append('\n// ============================================================\n')
    parts.append('// RENDER MEAL PLAN\n')
    parts.append('// ============================================================\n')
    parts.append(meal_render)

# ============================================================
# RENDER WORKOUT PLAN (adapted from workout file)
# ============================================================
wk_render_start = wk_logic.find('function renderPlan(mode)')
if wk_render_start >= 0:
    wk_render_end = wk_logic.find('// COPY AS TEXT', wk_render_start)
    if wk_render_end < 0: wk_render_end = wk_logic.find('function doCopy', wk_render_start)
    if wk_render_end >= 0:
        wk_render = wk_logic[wk_render_start:wk_render_end]
        wk_render = wk_render.replace('function renderPlan(mode)', 'function renderWorkoutPlan(mode)')
        wk_render = wk_render.replace('RULES[g]', 'WK_RULES[g]')
        wk_render = wk_render.replace('RULES.fatloss', 'WK_RULES.fatloss')
        wk_render = wk_render.replace('AVOID[g]', 'WK_AVOID[g]')
        wk_render = wk_render.replace('AVOID.fatloss', 'WK_AVOID.fatloss')
        wk_render = wk_render.replace('COACH_NOTES[g]', 'WK_COACH[g]')
        wk_render = wk_render.replace('COACH_NOTES.fatloss', 'WK_COACH.fatloss')
        parts.append('\n// ============================================================\n')
        parts.append('// RENDER WORKOUT PLAN\n')
        parts.append('// ============================================================\n')
        parts.append(wk_render)

# ============================================================
# doCopy (combined)
# ============================================================
parts.append('''
// ============================================================
// COPY PLAN (combined)
// ============================================================
function doCopy() {
  var name = document.getElementById('cName').value.trim() || 'Client';
  var t = 'COMBO PLAN — ' + name + '\\nBy Coach Akash Singh (@akash.liftsup)\\n' + '—'.repeat(45) + '\\n\\n';
  // Copy meal plan section
  var mealDiv = document.createElement('div');
  mealDiv.innerHTML = document.getElementById('outMeals').innerHTML;
  t += 'MEAL PLAN\\n';
  mealDiv.querySelectorAll('.mslot-hd').forEach(function(h) { t += '\\n' + h.textContent.trim() + '\\n'; });
  mealDiv.querySelectorAll('.mopt').forEach(function(o) { t += '  • ' + o.textContent.trim() + '\\n'; });
  // Copy workout section
  t += '\\n' + '—'.repeat(45) + '\\nWORKOUT SCHEDULE\\n';
  var wkEl = document.getElementById('outWk');
  if (wkEl) {
    wkEl.querySelectorAll('.wd').forEach(function(wd) {
      var hdr = wd.querySelector('.wdh');
      if (hdr) t += '\\n' + hdr.textContent.trim() + '\\n';
      wd.querySelectorAll('tr').forEach(function(tr) {
        var cells = tr.querySelectorAll('td');
        if (cells.length >= 2) t += '  • ' + cells[0].textContent + ': ' + cells[1].textContent + '\\n';
      });
    });
  }
  t += '\\n' + '—'.repeat(45) + '\\nCoach Akash Singh | @akash.liftsup';
  navigator.clipboard.writeText(t).then(function() {
    var btn = document.querySelector('#printWrap .btn-p');
    if (btn) { var orig = btn.textContent; btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = orig; }, 2000); }
  });
}
''')

parts.append('</script>\n')
parts.append('</body>\n</html>')

# ============================================================
# WRITE FILE
# ============================================================
output = ''.join(parts)
with open('D:\\Python\\Side Project\\Combo Plan.html', 'w', encoding='utf-8') as f:
    f.write(output)
print(f'Done! Combo Plan.html written ({len(output)} bytes, {output.count(chr(10))} lines)')
