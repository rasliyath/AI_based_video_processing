import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'
print('env set')
import torch
print('torch imported', torch.__version__)
print('cuda available:', torch.cuda.is_available())
