import { Pipe, PipeTransform, inject } from '@angular/core';
import { DataSaverService } from '../services/data-saver.service';

/** Cover art URL, swapped for a small version while Data Saver is on */
@Pipe({ name: 'art', standalone: true, pure: false })
export class ArtPipe implements PipeTransform {
  private saver = inject(DataSaverService);

  transform(url: string | null | undefined): string {
    return this.saver.art(url);
  }
}
