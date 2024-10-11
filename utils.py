import sys

class ProgressBar:
    def __init__(self, total=0, width=50, prefix='Progress:', suffix='Complete', decimals=1, fill='█', print_end="\r"):
        self.total = total
        self.width = width
        self.prefix = prefix
        self.suffix = suffix
        self.decimals = decimals
        self.fill = fill
        self.print_end = print_end
        self.iteration = 0

    def start(self, total):
        self.total = total
        self.print()

    def update(self, iteration):
        self.iteration = iteration
        self.print()

    def finish(self):
        self.update(self.total)
        print()

    def print(self):
        percent = ("{0:." + str(self.decimals) + "f}").format(100 * (self.iteration / float(self.total)))
        filled_length = int(self.width * self.iteration // self.total)
        bar = self.fill * filled_length + '-' * (self.width - filled_length)
        print(f'\r{self.prefix} |{bar}| {percent}% {self.suffix}', end=self.print_end)
        sys.stdout.flush()

class MultiStageProgressBar:
    def __init__(self, stages, width=50):
        self.stages = stages
        self.total_weight = sum(stage['weight'] for stage in stages)
        self.current_stage = 0
        self.progress_bar = ProgressBar(width=width)

    def start_stage(self, stage_name):
        self.current_stage = next(i for i, stage in enumerate(self.stages) if stage['name'] == stage_name)
        print(f"\nStarting: {self.stages[self.current_stage]['name']}")
        self.progress_bar.start(100)

    def update_stage(self, progress):
        self.progress_bar.update(progress)

    def finish_stage(self):
        self.progress_bar.finish()

    def get_overall_progress(self):
        completed_weight = sum(stage['weight'] for stage in self.stages[:self.current_stage])
        current_stage_progress = (self.progress_bar.iteration / 100) * self.stages[self.current_stage]['weight']
        return (completed_weight + current_stage_progress) / self.total_weight * 100

    def print_overall_progress(self):
        overall_progress = self.get_overall_progress()
        print(f"\nOverall Progress: {overall_progress:.1f}%")
