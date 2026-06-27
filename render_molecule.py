# /// script
# requires-python = ">=3.10, <3.13"
# dependencies = [
#     "pymol-open-source-whl",
# ]
# ///

import os
import sys
import urllib.request

# Скачиваем файл со структурой GFP (Зеленый флуоресцентный белок)
cif_path = "1gfl.cif"
if not os.path.exists(cif_path):
    print("Downloading 1GFL.cif...")
    urllib.request.urlretrieve("https://files.rcsb.org/download/1GFL.cif", cif_path)

os.environ["PYOPENGL_PLATFORM"] = "osmesa"
import pymol
pymol.pymol_argv = ["pymol", "-cq"]
pymol.finish_launching()
from pymol import cmd

cmd.load(cif_path, "structure")
count = cmd.count_atoms("all")
if count == 0:
    print("Error: No atoms loaded.")
    cmd.quit()
    sys.exit(1)

# Настройка отображения
cmd.hide("everything")
cmd.show("cartoon")
# Раскрашиваем по вторичной структуре (спирали - зеленые, листы - желтые)
cmd.color("green", "ss h")
cmd.color("yellow", "ss s")
cmd.color("gray", "ss l+''")

# Выделяем хромофор (ту самую часть, которая светится)
cmd.select("chromophore", "resn CRO")
cmd.show("sticks", "chromophore")
cmd.color("magenta", "chromophore")
cmd.zoom("structure")

cmd.set("ray_opaque_background", 1)
os.makedirs("output", exist_ok=True)
cmd.png("output/1gfl_render.png", width=1200, height=900, dpi=150)
cmd.save("output/1gfl_session.pse")
cmd.quit()
print("Render saved to output/1gfl_render.png")
