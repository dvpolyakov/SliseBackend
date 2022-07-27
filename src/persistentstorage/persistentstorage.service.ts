import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { S3 } from 'aws-sdk';

@Injectable()
export class PersistentStorageService {
  private readonly logger = new Logger(PersistentStorageService.name);
  public async upload(file): Promise<any> {
    const filename = file.originalname;
    const bucketS3 = 'bucketeer-97d78e08-2ff3-4666-a58b-8bb699a71923';
    return await this.uploadS3(file.buffer, bucketS3, filename);
  }

  private async uploadS3(file, bucket, name): Promise<any> {
    const s3 = PersistentStorageService.getS3();
    const params = {
      Bucket: bucket,
      Key: String(name),
      Body: file,
    };
    const data = await s3.upload(params).promise()
      .then((res) => {
        return res;
      })
      .catch(e => {
        this.logger.debug(e.toString())
        return null;
      });
    return data;
  }

  public async getFile(key: string): Promise<any> {
    const s3 = PersistentStorageService.getS3();
    const params = {
      Bucket: 'bucketeer-97d78e08-2ff3-4666-a58b-8bb699a71923',
      Key: String(key),
    };
    const file = await s3.getObject(params).promise();
    return file;
  }

  private static getS3() {
    return new S3({
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    });
  }
}